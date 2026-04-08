/**
 * Tests for the checkAnswer middleware.
 *
 * Strategy:
 *  - Real in-memory MongoDB for model operations.
 *  - Fake grammY Context with enough surface to drive the code.
 *  - After calling checkAnswer(), flush with setTimeout(150ms) so background
 *    .then() chains (addToBalance -> findUser -> sendMessage) complete before
 *    we query the DB.
 */
import { mongoose } from '@typegoose/typegoose'
import * as db from '../setup/db'
import { makeCtx } from '../setup/contextFactory'
import { checkAnswer, computeAccuracy } from '@/middlewares/checkAnswer'
import { QuizModel } from '@/models/Quiz'
import { getOrCreateUser, findUser, UserModel } from '@/models/User'
import { upsertTopicMembership } from '@/models/TopicMembership'
import { Difficulty } from '@/models/User'

// --- lifecycle ---
beforeAll(() => db.connect())
afterAll(() => db.disconnect())
afterEach(() => db.clear())

// --- helpers ---
async function flush(ms = 150) {
    await new Promise<void>(resolve => setTimeout(resolve, ms))
}

async function createQuiz(authorId: number, sectionId?: mongoose.Types.ObjectId, correctIndices: number[] = [0]) {
    return QuizModel.create({
        question: 'What is 2+2?',
        answers: ['4', '3', '5'],
        correctAnswerIndices: correctIndices,
        authorId,
        sectionId,
    })
}

/**
 * Build a poll update with correct_option_ids (array).
 * For single-correct: correctVoted=true means user picked the correct one.
 * For multi-correct: use makeMultiPoll instead.
 */
function makePoll(pollId: string, correctVoted: boolean) {
    return {
        id: pollId,
        type: 'quiz',
        question: 'Q?',
        correct_option_ids: [0],
        options: correctVoted
            ? [{ text: '4', voter_count: 1 }, { text: '3', voter_count: 0 }]
            : [{ text: '4', voter_count: 0 }, { text: '3', voter_count: 1 }],
        is_closed: false,
    }
}

/**
 * Build a multi-correct poll update.
 * pickedIndices: which options the user voted for (voter_count=1)
 * correctIndices: which options are correct
 * totalOptions: total number of options
 */
function makeMultiPoll(pollId: string, pickedIndices: number[], correctIndices: number[], totalOptions: number) {
    const options = Array.from({ length: totalOptions }, (_, i) => ({
        text: `Option ${i}`,
        voter_count: pickedIndices.includes(i) ? 1 : 0,
    }))
    return {
        id: pollId,
        type: 'quiz',
        question: 'Multi Q?',
        correct_option_ids: correctIndices,
        options,
        is_closed: false,
    }
}

async function buildScenario(opts: {
    solverId: number
    authorId: number
    inviterId?: number
    difficulty?: Difficulty
    correctAnswer?: boolean
    correctIndices?: number[]
    poll?: any
}) {
    const {
        solverId,
        authorId,
        inviterId,
        difficulty = Difficulty.Normal,
        correctAnswer = true,
        correctIndices = [0],
    } = opts

    const sectionId = inviterId !== undefined ? new mongoose.Types.ObjectId() : undefined
    await getOrCreateUser(authorId)
    await getOrCreateUser(solverId)

    if (inviterId !== undefined) {
        await getOrCreateUser(inviterId)
        await upsertTopicMembership(sectionId!, solverId, inviterId)
    }

    const quiz = await createQuiz(authorId, sectionId, correctIndices)
    const pollId = `poll-${solverId}-${Date.now()}`

    const poll = opts.poll ?? makePoll(pollId, correctAnswer)
    // Override pollId to match
    poll.id = pollId

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
        poll: poll as any,
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

// --- computeAccuracy unit tests ---
describe('computeAccuracy', () => {
    it('returns 1.0 for perfect single-correct answer', () => {
        expect(computeAccuracy([0], [0], 4)).toBe(1.0)
    })

    it('returns 0 for wrong single-correct answer', () => {
        expect(computeAccuracy([1], [0], 4)).toBe(0)
    })

    it('returns 1.0 for all correct picked in multi-correct', () => {
        expect(computeAccuracy([0, 2], [0, 2], 4)).toBe(1.0)
    })

    it('returns partial credit for some correct picked', () => {
        // 1/2 correct, 0 wrong => 0.5
        expect(computeAccuracy([0], [0, 2], 4)).toBe(0.5)
    })

    it('penalizes wrong picks', () => {
        // 1/2 correct, 1/2 wrong => 0.5 - 0.5 = 0
        expect(computeAccuracy([0, 1], [0, 2], 4)).toBe(0)
    })

    it('clamps to zero (never negative)', () => {
        // 0/1 correct, 1/3 wrong => 0 - 0.333 => clamped to 0
        expect(computeAccuracy([1], [0], 4)).toBe(0)
    })

    it('handles all options correct', () => {
        // All 3 correct, user picks all 3
        expect(computeAccuracy([0, 1, 2], [0, 1, 2], 3)).toBe(1.0)
    })
})

// --- guard clauses ---
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
            poll: { id: 'p1', type: 'regular', options: [], correct_option_ids: [0] } as any,
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
        expect(ctx.dbuser.quizId).toBeNull()
        expect(ctx.dbuser.pollId).toBeNull()
    })
})

// --- incorrect answer ---
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

// --- free-play (no inviter) — 60/40 split ---
describe('checkAnswer — free-play (no inviter, 60/40)', () => {
    it('gives solver 60% and author 40% of the total reward', async () => {
        const { ctx, authorId } = await buildScenario({ solverId: 2001, authorId: 2002 })

        await checkAnswer(ctx, jest.fn())
        await flush()

        // totalReward = 100 + (100/10 * 0) = 100, Normal = x1, accuracy = 1.0
        const expectedSolver = 100 * 0.6   // 60
        const expectedAuthor = 100 * 0.4   // 40

        expect(ctx.dbuser.balance).toBeCloseTo(expectedSolver, 0)
        expect(ctx.dbuser.multiplier).toBe(1)

        const authorDb = await findUser(authorId)
        expect(authorDb!.balance).toBeCloseTo(expectedAuthor, 0)
    })

    it('sends a success message to the solver', async () => {
        const { ctx } = await buildScenario({ solverId: 2001, authorId: 2002 })
        await checkAnswer(ctx, jest.fn())
        await flush()
        const recipients = ctx.api.sendMessage.mock.calls.map((c: any[]) => c[0])
        expect(recipients).toContain(2001)
    })

    it('sends an author-reward notification when author differs from solver', async () => {
        const { ctx } = await buildScenario({ solverId: 2001, authorId: 2002 })
        await checkAnswer(ctx, jest.fn())
        await flush()
        const recipients = ctx.api.sendMessage.mock.calls.map((c: any[]) => c[0])
        expect(recipients).toContain(2001)
        expect(recipients).toContain(2002)
    })

    it('adds both solver + author shares when solver IS the author', async () => {
        const { ctx } = await buildScenario({ solverId: 3001, authorId: 3001 })
        await checkAnswer(ctx, jest.fn())
        await flush()
        // solver gets 60% inline + 40% as author = 100%
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

        // totalReward = 100 + (100/10 * 3) = 130, solver gets 60% = 78
        expect(ctx.dbuser.balance).toBeCloseTo(78, 0)
    })
})

// --- topic-invite mode — 40/40/20 split ---
describe('checkAnswer — topic-invite mode (40/40/20)', () => {
    it('distributes 40% solver, 40% author, 20% inviter', async () => {
        const { ctx, authorId, inviterId } = await buildScenario({
            solverId: 5001,
            authorId: 5002,
            inviterId: 5003,
        })

        await checkAnswer(ctx, jest.fn())
        await flush()

        const expectedSolver = 100 * 0.40   // 40
        const expectedAuthor = 100 * 0.40   // 40
        const expectedInviter = 100 * 0.20  // 20

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

        const recipients = ctx.api.sendMessage.mock.calls.map((c: any[]) => c[0])
        expect(recipients).toContain(5001)
        expect(recipients).toContain(5002)
        expect(recipients).toContain(5003)
    })

    it('falls back to 60/40 when inviterId === solverId (self-join)', async () => {
        const { ctx } = await buildScenario({
            solverId: 6001,
            authorId: 6002,
            inviterId: 6001, // same as solver => hasInviter = false
        })

        await checkAnswer(ctx, jest.fn())
        await flush()

        expect(ctx.dbuser.balance).toBeCloseTo(100 * 0.6, 0)
    })
})

// --- difficulty multipliers ---
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
            const expectedSolver = expectedTotal * 0.6
            expect(ctx.dbuser.balance).toBeCloseTo(expectedSolver, 0)
        })
    })
})

// --- multi-correct quiz scenarios ---
describe('checkAnswer — multi-correct quizzes', () => {
    it('gives full reward when all correct options picked', async () => {
        const correctIndices = [0, 2]
        const poll = makeMultiPoll('p', [0, 2], [0, 2], 4)
        const { ctx } = await buildScenario({
            solverId: 8001,
            authorId: 8002,
            correctIndices,
            poll,
        })

        await checkAnswer(ctx, jest.fn())
        await flush()

        // accuracy=1.0, totalReward=100, solver=60
        expect(ctx.dbuser.balance).toBeCloseTo(60, 0)
        expect(ctx.dbuser.multiplier).toBe(1) // perfect => +1
    })

    it('gives partial reward when some correct picked (no wrong)', async () => {
        const correctIndices = [0, 2]
        const poll = makeMultiPoll('p', [0], [0, 2], 4) // 1 of 2 correct
        const { ctx } = await buildScenario({
            solverId: 8011,
            authorId: 8012,
            correctIndices,
            poll,
        })

        await checkAnswer(ctx, jest.fn())
        await flush()

        // accuracy = 1/2 = 0.5, totalReward=100*0.5=50, solver=50*0.6=30
        expect(ctx.dbuser.balance).toBeCloseTo(30, 0)
        expect(ctx.dbuser.multiplier).toBe(0) // not perfect => reset
    })

    it('penalizes wrong picks', async () => {
        const correctIndices = [0, 1]
        // Picked 0 (correct) and 2 (wrong) out of [0,1] correct, 4 options total
        const poll = makeMultiPoll('p', [0, 2], [0, 1], 4)
        const { ctx } = await buildScenario({
            solverId: 8021,
            authorId: 8022,
            correctIndices,
            poll,
        })

        await checkAnswer(ctx, jest.fn())
        await flush()

        // accuracy = 1/2 - 1/2 = 0 => no reward
        expect(ctx.dbuser.balance).toBe(0)
        expect(ctx.dbuser.multiplier).toBe(0)
    })

    it('gives zero reward when all wrong picked', async () => {
        const correctIndices = [0]
        const poll = makeMultiPoll('p', [1], [0], 3) // picked wrong
        const { ctx } = await buildScenario({
            solverId: 8031,
            authorId: 8032,
            correctIndices,
            poll,
        })

        await checkAnswer(ctx, jest.fn())
        await flush()

        expect(ctx.dbuser.balance).toBe(0)
        expect(ctx.dbuser.multiplier).toBe(0)
    })
})
