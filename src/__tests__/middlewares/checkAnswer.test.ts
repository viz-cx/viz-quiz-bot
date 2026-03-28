/**
 * Tests for the checkAnswer middleware.
 *
 * Strategy:
 *  - Real in-memory MongoDB for model operations.
 *  - Fake Telegraf Context with enough surface to drive the code.
 *  - After calling checkAnswer(), flush with setTimeout(100ms) so background
 *    .then() chains (addToBalance → findUser → sendMessage) complete before
 *    we query the DB.
 *  - NOTE: makeCtx() SPREADS the provided dbuser into a new object, so all
 *    assertions must reference ctx.dbuser, not the local variable passed in.
 */
import { mongoose } from '@typegoose/typegoose'
import * as db from '../setup/db'
import { makeCtx } from '../setup/contextFactory'
import { checkAnswer } from '@/middlewares/checkAnswer'
import { QuizModel } from '@/models/Quiz'
import { getOrCreateUser, findUser, UserModel } from '@/models/User'
import { upsertTopicMembership } from '@/models/TopicMembership'
import { Difficulty } from '@/models/User'

// ─── lifecycle ───────────────────────────────────────────────────────────────
beforeAll(() => db.connect())
afterAll(() => db.disconnect())
afterEach(() => db.clear())

// ─── helpers ─────────────────────────────────────────────────────────────────
/** Wait long enough for all background .then() chains to complete. */
async function flush(ms = 150) {
    await new Promise<void>(resolve => setTimeout(resolve, ms))
}

async function createQuiz(authorId: number, sectionId?: mongoose.Types.ObjectId) {
    return QuizModel.create({
        question: 'What is 2+2?',
        answers: ['4', '3', '5'],
        authorId,
        sectionId,
    })
}

/**
 * Build a poll update that looks like a single correct (or wrong) vote.
 * correct_option_id = 0 → first answer is correct.
 */
function makePoll(pollId: string, correctVoted: boolean) {
    return {
        id: pollId,
        type: 'quiz',
        question: 'Q?',
        correct_option_id: 0,
        options: correctVoted
            ? [{ text: '4', voter_count: 1 }, { text: '3', voter_count: 0 }]
            : [{ text: '4', voter_count: 0 }, { text: '3', voter_count: 1 }],
        is_closed: false,
    }
}

/**
 * Build a context for a poll-answer scenario backed by real DB records.
 * The ctx.dbuser object is what makeCtx creates from the provided overrides —
 * callers must use ctx.dbuser for post-call assertions.
 */
async function buildScenario(opts: {
    solverId: number
    authorId: number
    inviterId?: number
    difficulty?: Difficulty
    correctAnswer?: boolean
}) {
    const {
        solverId,
        authorId,
        inviterId,
        difficulty = Difficulty.Normal,
        correctAnswer = true,
    } = opts

    const sectionId = inviterId !== undefined ? new mongoose.Types.ObjectId() : undefined
    await getOrCreateUser(authorId)
    await getOrCreateUser(solverId)

    if (inviterId !== undefined) {
        await getOrCreateUser(inviterId)
        await upsertTopicMembership(sectionId!, solverId, inviterId)
    }

    const quiz = await createQuiz(authorId, sectionId)
    const pollId = `poll-${solverId}-${Date.now()}`

    const ctx = makeCtx({
        dbuser: {
            id: solverId,
            balance: 0,
            multiplier: 0,
            difficulty,
            answered: [],
            quizId: quiz._id,
            pollId,
        } as any,
        poll: makePoll(pollId, correctAnswer) as any,
    })

    // Wire ctx.dbuser.save() to actually persist balance changes
    ctx.dbuser.save = jest.fn(async () => {
        await UserModel.updateOne(
            { id: solverId },
            { $set: { balance: ctx.dbuser.balance, multiplier: ctx.dbuser.multiplier } }
        )
    })

    return { ctx, quiz, solverId, authorId, inviterId, sectionId }
}

// ─── guard clauses ────────────────────────────────────────────────────────────
describe('checkAnswer — guard clauses', () => {
    it('calls next() when ctx.poll is falsy', async () => {
        const ctx = makeCtx()
        ctx.poll = null
        const next = jest.fn()
        await checkAnswer(ctx, next)
        expect(next).toHaveBeenCalled()
    })

    it('calls next() when poll type is not quiz', async () => {
        const ctx = makeCtx({
            poll: { id: 'p1', type: 'regular', options: [], correct_option_id: 0 } as any,
            dbuser: { pollId: 'other-poll' } as any,
        })
        const next = jest.fn()
        await checkAnswer(ctx, next)
        expect(next).toHaveBeenCalled()
    })

    it('calls next() when quiz has already been answered', async () => {
        const quiz = await createQuiz(1)
        const ctx = makeCtx({
            poll: makePoll('p1', true) as any,
            dbuser: { pollId: 'p1', quizId: quiz._id, answered: [quiz._id] } as any,
        })
        const next = jest.fn()
        await checkAnswer(ctx, next)
        expect(next).toHaveBeenCalled()
    })

    it('resets quizId when poll.id does not match user.pollId', async () => {
        const quiz = await createQuiz(1)
        const ctx = makeCtx({
            poll: makePoll('poll-DIFFERENT', true) as any,
            dbuser: {
                id: 1,
                pollId: 'poll-OTHER',
                quizId: quiz._id,
                quizMessageId: 5,
                answered: [],
                balance: 0,
                multiplier: 0,
            } as any,
        })
        const next = jest.fn()
        await checkAnswer(ctx, next)
        expect(next).toHaveBeenCalled()
        // checkAnswer mutates ctx.dbuser (the spread object), not the local variable
        expect(ctx.dbuser.quizId).toBeNull()
        expect(ctx.dbuser.pollId).toBeNull()
    })
})

// ─── incorrect answer ─────────────────────────────────────────────────────────
describe('checkAnswer — incorrect answer', () => {
    it('resets multiplier to 0 and does not change balance', async () => {
        const quiz = await createQuiz(999)
        const pollId = 'poll-wrong'

        const ctx = makeCtx({
            dbuser: {
                id: 1001,
                balance: 100,
                multiplier: 5,
                difficulty: Difficulty.Normal,
                answered: [],
                quizId: quiz._id,
                pollId,
            } as any,
            poll: makePoll(pollId, false) as any,
        })
        ctx.dbuser.save = jest.fn().mockResolvedValue(undefined)

        await checkAnswer(ctx, jest.fn())
        await flush()

        expect(ctx.dbuser.multiplier).toBe(0)
        expect(ctx.dbuser.balance).toBe(100)   // unchanged
    })
})

// ─── free-play (no inviter) — 50 / 50 split ──────────────────────────────────
describe('checkAnswer — free-play (no inviter)', () => {
    it('gives solver 50% and author 50% of the total reward', async () => {
        const { ctx, authorId } = await buildScenario({ solverId: 2001, authorId: 2002 })

        await checkAnswer(ctx, jest.fn())
        await flush()

        // totalReward = 100 + (100/10 * 0) = 100, Normal multiplier = ×1
        const expectedSolver = 100 * 0.5   // 50
        const expectedAuthor = 100 * 0.5   // 50

        expect(ctx.dbuser.balance).toBeCloseTo(expectedSolver, 0)
        expect(ctx.dbuser.multiplier).toBe(1)

        const authorDb = await findUser(authorId)
        expect(authorDb!.balance).toBeCloseTo(expectedAuthor, 0)
    })

    it('sends a success message to the solver', async () => {
        const { ctx } = await buildScenario({ solverId: 2001, authorId: 2002 })
        await checkAnswer(ctx, jest.fn())
        await flush()
        const recipients = ctx.telegram.sendMessage.mock.calls.map((c: any[]) => c[0])
        expect(recipients).toContain(2001)
    })

    it('sends an author-reward notification when author differs from solver', async () => {
        const { ctx } = await buildScenario({ solverId: 2001, authorId: 2002 })
        await checkAnswer(ctx, jest.fn())
        await flush()
        const recipients = ctx.telegram.sendMessage.mock.calls.map((c: any[]) => c[0])
        expect(recipients).toContain(2001) // solver
        expect(recipients).toContain(2002) // author
    })

    it('adds both solver + author shares to the same user when solver IS the author', async () => {
        const { ctx } = await buildScenario({ solverId: 3001, authorId: 3001 })
        await checkAnswer(ctx, jest.fn())
        await flush()
        // solver gets 50% inline, then another 50% for being author = 100%
        expect(ctx.dbuser.balance).toBeCloseTo(100, 0)
    })

    it('multiplier boosts total reward by 10% per point', async () => {
        const quiz = await createQuiz(4002)
        await getOrCreateUser(4001)
        await getOrCreateUser(4002)
        const pollId = 'poll-multiplier'

        const ctx = makeCtx({
            dbuser: {
                id: 4001,
                balance: 0,
                multiplier: 3,
                difficulty: Difficulty.Normal,
                answered: [],
                quizId: quiz._id,
                pollId,
            } as any,
            poll: makePoll(pollId, true) as any,
        })
        ctx.dbuser.save = jest.fn().mockResolvedValue(undefined)

        await checkAnswer(ctx, jest.fn())
        await flush()

        // totalReward = 100 + (100/10 * 3) = 130, solver gets 50% = 65
        expect(ctx.dbuser.balance).toBeCloseTo(65, 0)
    })
})

// ─── topic-invite mode — 25 / 50 / 25 split ──────────────────────────────────
describe('checkAnswer — topic-invite mode (25/50/25)', () => {
    it('distributes 25% solver, 50% author, 25% inviter', async () => {
        const { ctx, authorId, inviterId } = await buildScenario({
            solverId: 5001,
            authorId: 5002,
            inviterId: 5003,
        })

        await checkAnswer(ctx, jest.fn())
        await flush()

        const expectedSolver = 100 * 0.25   // 25
        const expectedAuthor = 100 * 0.50   // 50
        const expectedInviter = 100 * 0.25  // 25

        expect(ctx.dbuser.balance).toBeCloseTo(expectedSolver, 0)

        const authorDb = await findUser(authorId!)
        expect(authorDb!.balance).toBeCloseTo(expectedAuthor, 0)

        const inviterDb = await findUser(inviterId!)
        expect(inviterDb!.balance).toBeCloseTo(expectedInviter, 0)
    })

    it('sends reward notifications to solver, author and inviter', async () => {
        const { ctx } = await buildScenario({
            solverId: 5001,
            authorId: 5002,
            inviterId: 5003,
        })

        await checkAnswer(ctx, jest.fn())
        await flush()

        const recipients = ctx.telegram.sendMessage.mock.calls.map((c: any[]) => c[0])
        expect(recipients).toContain(5001) // solver
        expect(recipients).toContain(5002) // author
        expect(recipients).toContain(5003) // inviter
    })

    it('falls back to 50/50 when inviterId === solverId (self-join)', async () => {
        const { ctx } = await buildScenario({
            solverId: 6001,
            authorId: 6002,
            inviterId: 6001, // same as solver → hasInviter = false
        })

        await checkAnswer(ctx, jest.fn())
        await flush()

        expect(ctx.dbuser.balance).toBeCloseTo(100 * 0.5, 0)
    })
})

// ─── difficulty multipliers ───────────────────────────────────────────────────
describe('checkAnswer — difficulty scaling', () => {
    const cases: Array<[Difficulty, string, number]> = [
        [Difficulty.Easy,      'Easy',      0.5],
        [Difficulty.Normal,    'Normal',    1.0],
        [Difficulty.Hard,      'Hard',      1.5],
        [Difficulty.Nightmare, 'Nightmare', 2.0],
    ]

    cases.forEach(([difficulty, name, scale]) => {
        it(`scales reward by ${scale}x for ${name}`, async () => {
            const authorId = 7000 + difficulty * 10 + 2
            const solverId = 7000 + difficulty * 10 + 1
            await getOrCreateUser(authorId)
            const quiz = await createQuiz(authorId)
            const pollId = `poll-diff-${difficulty}`

            const ctx = makeCtx({
                dbuser: {
                    id: solverId,
                    balance: 0,
                    multiplier: 0,
                    difficulty,
                    answered: [],
                    quizId: quiz._id,
                    pollId,
                } as any,
                poll: makePoll(pollId, true) as any,
            })
            ctx.dbuser.save = jest.fn().mockResolvedValue(undefined)

            await checkAnswer(ctx, jest.fn())
            await flush()

            const expectedTotal = 100 * scale
            const expectedSolver = expectedTotal * 0.5
            expect(ctx.dbuser.balance).toBeCloseTo(expectedSolver, 0)
        })
    })
})
