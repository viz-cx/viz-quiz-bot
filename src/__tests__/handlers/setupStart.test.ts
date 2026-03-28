/**
 * Tests for the topic-invite deep-link parsing in setupStart.
 *
 * setupStart() registers a Telegraf bot.start() handler. We extract and test
 * the inner logic directly by building a mock context with a startPayload.
 *
 * Because setupStart requires a Telegraf bot instance, we mock the relevant
 * pieces and invoke the handler function returned by bot.start() capture.
 */
import { mongoose } from '@typegoose/typegoose'
import * as db from '../setup/db'
import { makeCtx } from '../setup/contextFactory'
import { SectionModel } from '@/models/Section'
import { UserModel, getOrCreateUser, findUser } from '@/models/User'
import { TopicMembershipModel } from '@/models/TopicMembership'

// ─── lifecycle ───────────────────────────────────────────────────────────────
beforeAll(() => db.connect())
afterAll(() => db.disconnect())
afterEach(() => db.clear())

// ─── helpers ─────────────────────────────────────────────────────────────────

/**
 * Capture the start handler that setupStart registers on the bot, then call it
 * with a mock context. This avoids having to spin up a real Telegraf bot.
 */
async function invokeStartHandler(ctx: any) {
    let capturedHandler: Function | null = null

    const fakeBotStart = (fn: Function) => { capturedHandler = fn }
    const fakeBot = { start: fakeBotStart } as any

    // Dynamically require to avoid module-alias runtime issues in Jest
    const { setupStart } = await import('@/handlers/setupStart')
    setupStart(fakeBot)

    if (!capturedHandler) throw new Error('start handler was not registered')
    await capturedHandler(ctx)
}

async function createSection(title: string, authorId: number) {
    return SectionModel.create({ title, authorId, isPublic: true, quizzes: [] })
}

// ─── topic deep-link: t_<sectionId>_<inviterId> ───────────────────────────────
describe('setupStart — topic invite deep-link', () => {
    it('sets activeTopicSection on the user when the link is valid', async () => {
        const section = await createSection('Crypto Basics', 999)
        const user = await getOrCreateUser(1001)

        // makeCtx SPREADS dbuser — wire save() AFTER ctx is created so the
        // mock captures ctx.dbuser (the actual mutated object), not the local var
        const ctx = makeCtx({ dbuser: { ...user!.toObject(), id: 1001 } as any })
        ctx['startPayload'] = `t_${section._id}_999`
        ctx.dbuser.save = jest.fn().mockResolvedValue(ctx.dbuser)

        await invokeStartHandler(ctx)

        // setupStart sets user.activeTopicSection = section on ctx.dbuser
        expect(ctx.dbuser.activeTopicSection).toBeDefined()
        expect(ctx.dbuser.save).toHaveBeenCalled()
    })

    it('creates a TopicMembership record with the correct inviterId', async () => {
        const section = await createSection('Blockchain', 999)
        const user = await getOrCreateUser(2001)
        await getOrCreateUser(999) // inviter

        const dbuser = Object.assign({}, user!.toObject(), {
            id: 2001,
            save: jest.fn().mockResolvedValue(undefined),
        })

        const payload = `t_${section._id}_999`
        const ctx = makeCtx({ dbuser: dbuser as any })
        ctx['startPayload'] = payload

        await invokeStartHandler(ctx)

        const membership = await TopicMembershipModel.findOne({
            sectionId: new mongoose.Types.ObjectId(section._id.toString()),
            userId: 2001,
        })
        expect(membership).not.toBeNull()
        expect(membership!.inviterId).toBe(999)
    })

    it('sends the topic_invite_joined reply', async () => {
        const section = await createSection('DeFi', 999)
        const user = await getOrCreateUser(3001)

        const dbuser = Object.assign({}, user!.toObject(), {
            id: 3001,
            save: jest.fn().mockResolvedValue(undefined),
        })

        const payload = `t_${section._id}_999`
        const ctx = makeCtx({ dbuser: dbuser as any })
        ctx['startPayload'] = payload

        await invokeStartHandler(ctx)

        expect(ctx.replyWithHTML).toHaveBeenCalledWith(
            expect.stringContaining('topic_invite_joined')
        )
    })

    it('is idempotent — joining the same topic twice keeps the original inviter', async () => {
        const section = await createSection('NFTs', 999)
        await getOrCreateUser(4001)
        await getOrCreateUser(999)
        await getOrCreateUser(888) // different inviter on second visit

        const makeDbuser = (u: any) => Object.assign({}, u.toObject(), {
            id: 4001,
            save: jest.fn().mockResolvedValue(undefined),
        })

        // First join
        const user1 = await findUser(4001)
        const ctx1 = makeCtx({ dbuser: makeDbuser(user1) as any })
        ctx1['startPayload'] = `t_${section._id}_999`
        await invokeStartHandler(ctx1)

        // Second join with a different inviter
        const user2 = await findUser(4001)
        const ctx2 = makeCtx({ dbuser: makeDbuser(user2) as any })
        ctx2['startPayload'] = `t_${section._id}_888`
        await invokeStartHandler(ctx2)

        const memberships = await TopicMembershipModel.find({ userId: 4001 })
        expect(memberships).toHaveLength(1)
        expect(memberships[0].inviterId).toBe(999) // original preserved
    })
})

// ─── topic deep-link: invalid formats ────────────────────────────────────────
describe('setupStart — invalid deep-links', () => {
    it('falls through gracefully when payload is empty', async () => {
        const user = await getOrCreateUser(5001)
        const dbuser = Object.assign({}, user!.toObject(), {
            id: 5001,
            referrer: 1, // already has referrer so skip referral path
            save: jest.fn().mockResolvedValue(undefined),
        })
        const ctx = makeCtx({ dbuser: dbuser as any })
        ctx['startPayload'] = ''

        await expect(invokeStartHandler(ctx)).resolves.not.toThrow()
    })

    it('ignores a topic prefix with missing inviterId', async () => {
        const section = await createSection('Incomplete', 1)
        const user = await getOrCreateUser(5002)
        const dbuser = Object.assign({}, user!.toObject(), {
            id: 5002,
            save: jest.fn().mockResolvedValue(undefined),
        })
        const ctx = makeCtx({ dbuser: dbuser as any })
        ctx['startPayload'] = `t_${section._id}` // missing _<inviterId>

        await expect(invokeStartHandler(ctx)).resolves.not.toThrow()
        const count = await TopicMembershipModel.countDocuments({ userId: 5002 })
        expect(count).toBe(0)
    })

    it('ignores a topic prefix with a non-existent sectionId', async () => {
        const user = await getOrCreateUser(5003)
        const dbuser = Object.assign({}, user!.toObject(), {
            id: 5003,
            save: jest.fn().mockResolvedValue(undefined),
        })
        const fakeId = new mongoose.Types.ObjectId().toString()
        const ctx = makeCtx({ dbuser: dbuser as any })
        ctx['startPayload'] = `t_${fakeId}_999`

        await expect(invokeStartHandler(ctx)).resolves.not.toThrow()
        const count = await TopicMembershipModel.countDocuments({ userId: 5003 })
        expect(count).toBe(0)
    })
})

// ─── referral link ────────────────────────────────────────────────────────────
describe('setupStart — referral link', () => {
    it('sets referrer on the user when a valid referrer id is provided', async () => {
        await getOrCreateUser(6001) // the referrer
        const user = await getOrCreateUser(6002)

        // Wire save() AFTER ctx is created so the mock uses ctx.dbuser.
        // save() must return { id } because setupStart chains .then(u => u.id)
        const ctx = makeCtx({ dbuser: { ...user!.toObject(), id: 6002, referrer: undefined } as any })
        ctx['startPayload'] = '6001'
        ctx.dbuser.save = jest.fn().mockResolvedValue({ id: 6002 })

        await invokeStartHandler(ctx)
        // Wait for the fire-and-forget findUser().then() chain to settle
        await new Promise<void>(r => setTimeout(r, 150))

        // setupStart sets user.referrer = 6001 on ctx.dbuser
        expect(ctx.dbuser.referrer).toBe(6001)
    })

    it('does not assign a referrer when referrer id equals own id (no self-referral)', async () => {
        const user = await getOrCreateUser(7001)
        const dbuser = Object.assign({}, user!.toObject(), {
            id: 7001,
            referrer: undefined,
            save: jest.fn().mockResolvedValue(undefined),
        })
        const ctx = makeCtx({ dbuser: dbuser as any })
        ctx['startPayload'] = '7001' // same as own id

        await invokeStartHandler(ctx)
        await new Promise<void>(r => setImmediate(r))

        // referrer should NOT be set
        expect(dbuser.referrer).toBeUndefined()
    })
})
