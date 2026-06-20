// src/__tests__/middlewares/answerCallback.test.ts
import { mongoose } from '@typegoose/typegoose'
import * as db from '../setup/db'
import { makeCtx } from '../setup/contextFactory'
import { answerCallback } from '@/middlewares/answerCallback'
import { QuizModel } from '@/models/Quiz'
import { getOrCreateUser } from '@/models/User'
import { Difficulty } from '@/models/User'

beforeAll(() => db.connect())
afterAll(() => db.disconnect())
afterEach(() => db.clear())

async function flush(ms = 150) {
    await new Promise<void>(resolve => setTimeout(resolve, ms))
}

async function makeQuiz(authorId: number) {
    return QuizModel.create({
        question: 'Q?', answers: ['right', 'wrong', 'nope'], correctAnswerIndices: [0],
        authorId, explanation: 'the why',
    })
}

function ctxFor(solverId: number, quizId: any, data: string, extra: any = {}) {
    const ctx = makeCtx({
        dbuser: {
            id: solverId, balance: 0, multiplier: 0, difficulty: Difficulty.Normal,
            answered: [], quizId, quizMessageId: 50,
            quizExpiresAt: new Date(Date.now() + 60000), ...extra,
        } as any,
        callbackQuery: { data, message: { message_id: 50 } } as any,
    })
    ctx.dbuser.save = jest.fn().mockResolvedValue(undefined)
    return ctx
}

describe('answerCallback', () => {
    it('pays on a correct tap and edits the message with the score', async () => {
        await getOrCreateUser(1102) // author
        await getOrCreateUser(1101)
        const quiz = await makeQuiz(1102)
        const ctx = ctxFor(1101, quiz._id, `ans:${quiz._id.toString()}:0`)

        await answerCallback(ctx, jest.fn())
        await flush()

        expect(ctx.dbuser.balance).toBeCloseTo(60, 0)
        expect(ctx.editMessageText).toHaveBeenCalled()
        expect(ctx.dbuser.quizId).toBeNull()
    })

    it('does not reveal correctness, just records, on a wrong tap', async () => {
        await getOrCreateUser(1202)
        const quiz = await makeQuiz(1202)
        const ctx = ctxFor(1201, quiz._id, `ans:${quiz._id.toString()}:1`, { multiplier: 4 })

        await answerCallback(ctx, jest.fn())
        await flush()

        expect(ctx.dbuser.balance).toBe(0)
        expect(ctx.dbuser.multiplier).toBe(0)
        expect(ctx.editMessageText).toHaveBeenCalled()
    })

    it('is idempotent: a stale callback (quizId already cleared) does not pay', async () => {
        const quiz = await makeQuiz(1302)
        const ctx = ctxFor(1301, null, `ans:${quiz._id.toString()}:0`)
        const next = jest.fn()

        await answerCallback(ctx, next)
        await flush()

        expect(ctx.dbuser.balance).toBe(0)
        expect(ctx.editMessageText).not.toHaveBeenCalled()
        expect(ctx.answerCallbackQuery).toHaveBeenCalled()
    })

    it('rejects an expired answer with no reward', async () => {
        const quiz = await makeQuiz(1402)
        const ctx = ctxFor(1401, quiz._id, `ans:${quiz._id.toString()}:0`,
            { quizExpiresAt: new Date(Date.now() - 1000) })

        await answerCallback(ctx, jest.fn())
        await flush()

        expect(ctx.dbuser.balance).toBe(0)
        expect(ctx.dbuser.quizId).toBeNull()
    })

    it('ignores an out-of-range option index', async () => {
        const quiz = await makeQuiz(1502)
        const ctx = ctxFor(1501, quiz._id, `ans:${quiz._id.toString()}:99`)

        await answerCallback(ctx, jest.fn())
        await flush()

        expect(ctx.dbuser.balance).toBe(0)
        expect(ctx.editMessageText).not.toHaveBeenCalled()
    })

    it('passes through non-ans callbacks via next()', async () => {
        const ctx = ctxFor(1601, new mongoose.Types.ObjectId(), 'next_quiz')
        const next = jest.fn()
        await answerCallback(ctx, next)
        expect(next).toHaveBeenCalled()
    })
})
