// src/__tests__/middlewares/award.test.ts
import { mongoose } from '@typegoose/typegoose'
import * as db from '../setup/db'
import { makeCtx } from '../setup/contextFactory'
import { awardForAnswer, MAX_MULTIPLIER, EARN_WINDOW_CAP } from '@/middlewares/award'
import { QuizModel } from '@/models/Quiz'
import { findUser, Difficulty } from '@/models/User'

beforeAll(() => db.connect())
afterAll(() => db.disconnect())
afterEach(() => db.clear())

async function flush(ms = 150) {
    await new Promise<void>(resolve => setTimeout(resolve, ms))
}

async function makeQuiz(authorId: number, sectionId?: mongoose.Types.ObjectId) {
    return QuizModel.create({
        question: 'Q?', answers: ['a', 'b', 'c'], correctAnswerIndices: [0],
        authorId, sectionId, explanation: 'because',
    })
}

function ctxFor(solverId: number, extra: any = {}) {
    const ctx = makeCtx({
        dbuser: {
            id: solverId, balance: 0, multiplier: 0, difficulty: Difficulty.Normal,
            answered: [], quizId: new mongoose.Types.ObjectId(), ...extra,
        } as any,
    })
    ctx.dbuser.save = jest.fn().mockResolvedValue(undefined)
    return ctx
}

describe('awardForAnswer', () => {
    it('pays solver 60% and author 40% on a correct answer', async () => {
        const quiz = await makeQuiz(5002)
        const ctx = ctxFor(5001, { quizId: quiz._id })

        const res = await awardForAnswer(ctx, quiz, true)
        await flush()

        expect(res.rewarded).toBe(true)
        expect(ctx.dbuser.balance).toBeCloseTo(100 * 0.6, 0) // 60
        expect(ctx.dbuser.multiplier).toBe(1)
        const authorDb = await findUser(5002)
        expect(authorDb!.balance).toBeCloseTo(100 * 0.4, 0) // 40
    })

    it('resets multiplier and pays nothing on an incorrect answer', async () => {
        const quiz = await makeQuiz(6002)
        const ctx = ctxFor(6001, { quizId: quiz._id, multiplier: 5 })
        const res = await awardForAnswer(ctx, quiz, false)
        expect(res.rewarded).toBe(false)
        expect(ctx.dbuser.balance).toBe(0)
        expect(ctx.dbuser.multiplier).toBe(0)
    })

    it('clamps a legacy over-cap multiplier', async () => {
        const quiz = await makeQuiz(7002)
        const ctx = ctxFor(7001, { quizId: quiz._id, multiplier: 309 })
        await awardForAnswer(ctx, quiz, true)
        // reward computed at MAX_MULTIPLIER: (100 + 100) * 0.6 = 120
        expect(ctx.dbuser.balance).toBeCloseTo(120, 0)
        expect(ctx.dbuser.multiplier).toBe(MAX_MULTIPLIER)
    })

    it('suppresses reward when answering too fast', async () => {
        const quiz = await makeQuiz(8002)
        const ctx = ctxFor(8001, { quizId: quiz._id, lastAnsweredAt: new Date() })
        const res = await awardForAnswer(ctx, quiz, true)
        expect(res.suppressed).toBe(true)
        expect(ctx.dbuser.balance).toBe(0)
    })

    it('suppresses reward when over the window cap', async () => {
        const quiz = await makeQuiz(9002)
        const ctx = ctxFor(9001, { quizId: quiz._id, earnWindowStart: new Date(), earnWindowCount: EARN_WINDOW_CAP })
        const res = await awardForAnswer(ctx, quiz, true)
        expect(res.suppressed).toBe(true)
        expect(ctx.dbuser.balance).toBe(0)
    })
})
