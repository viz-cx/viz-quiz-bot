import { mongoose } from '@typegoose/typegoose'
import * as db from '../setup/db'
import {
    TopicMembershipModel,
    upsertTopicMembership,
    getInviterForTopic,
} from '@/models/TopicMembership'

// ─── lifecycle ───────────────────────────────────────────────────────────────
beforeAll(() => db.connect())
afterAll(() => db.disconnect())
afterEach(() => db.clear())

// ─── helpers ─────────────────────────────────────────────────────────────────
const sid1 = new mongoose.Types.ObjectId()
const sid2 = new mongoose.Types.ObjectId()

// ─── upsertTopicMembership ────────────────────────────────────────────────────
describe('upsertTopicMembership', () => {
    it('creates a new membership document', async () => {
        await upsertTopicMembership(sid1, 42, 99)
        const doc = await TopicMembershipModel.findOne({ sectionId: sid1, userId: 42 })
        expect(doc).not.toBeNull()
        expect(doc!.inviterId).toBe(99)
    })

    it('is idempotent — calling twice keeps the original inviterId', async () => {
        await upsertTopicMembership(sid1, 42, 99)   // first invite
        await upsertTopicMembership(sid1, 42, 77)   // second call with different inviter

        const docs = await TopicMembershipModel.find({ sectionId: sid1, userId: 42 })
        expect(docs).toHaveLength(1)
        // $setOnInsert must NOT overwrite the original inviterId
        expect(docs[0].inviterId).toBe(99)
    })

    it('allows the same user to join different sections with different inviters', async () => {
        await upsertTopicMembership(sid1, 42, 10)
        await upsertTopicMembership(sid2, 42, 20)

        const m1 = await TopicMembershipModel.findOne({ sectionId: sid1, userId: 42 })
        const m2 = await TopicMembershipModel.findOne({ sectionId: sid2, userId: 42 })
        expect(m1!.inviterId).toBe(10)
        expect(m2!.inviterId).toBe(20)
    })

    it('allows different users to join the same section', async () => {
        await upsertTopicMembership(sid1, 1, 99)
        await upsertTopicMembership(sid1, 2, 99)

        const count = await TopicMembershipModel.countDocuments({ sectionId: sid1 })
        expect(count).toBe(2)
    })

    it('stores inviterId = 0 for self-discovered (no inviter)', async () => {
        await upsertTopicMembership(sid1, 42, 0)
        const doc = await TopicMembershipModel.findOne({ sectionId: sid1, userId: 42 })
        expect(doc!.inviterId).toBe(0)
    })
})

// ─── getInviterForTopic ───────────────────────────────────────────────────────
describe('getInviterForTopic', () => {
    it('returns 0 when no membership exists for that user+section', async () => {
        const result = await getInviterForTopic(sid1, 999)
        expect(result).toBe(0)
    })

    it('returns the correct inviterId when membership exists', async () => {
        await upsertTopicMembership(sid1, 42, 77)
        const result = await getInviterForTopic(sid1, 42)
        expect(result).toBe(77)
    })

    it('does not cross-contaminate users in the same section', async () => {
        await upsertTopicMembership(sid1, 1, 10)
        await upsertTopicMembership(sid1, 2, 20)

        expect(await getInviterForTopic(sid1, 1)).toBe(10)
        expect(await getInviterForTopic(sid1, 2)).toBe(20)
    })

    it('does not cross-contaminate sections for the same user', async () => {
        await upsertTopicMembership(sid1, 42, 10)
        await upsertTopicMembership(sid2, 42, 20)

        expect(await getInviterForTopic(sid1, 42)).toBe(10)
        expect(await getInviterForTopic(sid2, 42)).toBe(20)
    })
})
