import * as db from '../setup/db'
import { makeCtx } from '../setup/contextFactory'
import { sendQuiz } from '@/handlers/sendQuiz'
import { QuizModel } from '@/models/Quiz'
import { getOrCreateUser } from '@/models/User'
import { Difficulty } from '@/models/User'

beforeAll(() => db.connect())
afterAll(() => db.disconnect())
afterEach(() => db.clear())

async function createQuizInDb(answers: string[] = ['Right', 'Wrong1', 'Wrong2']) {
    return QuizModel.create({
        question: 'Test question?',
        answers,
        correctAnswerIndices: [0],
        explanation: 'Because yes',
        authorId: 9999,
    })
}

function makeQuizCtx(_quizId: any, difficulty: Difficulty = Difficulty.Normal) {
    const ctx = makeCtx({
        dbuser: {
            id: 1001, balance: 0, multiplier: 0, difficulty,
            answered: [], quizId: null, quizMessageId: null, activeTopicSection: undefined,
        } as any,
    })
    ctx.reply = jest.fn().mockResolvedValue({ message_id: 42 })
    ctx.dbuser.save = jest.fn().mockResolvedValue(undefined)
    return ctx
}

describe('sendQuiz — inline buttons', () => {
    it('sends the question with one callback button per answer', async () => {
        await getOrCreateUser(9999)
        await getOrCreateUser(1001)
        const quiz = await createQuizInDb(['A', 'B', 'C', 'D'])
        const ctx = makeQuizCtx(quiz._id)

        await sendQuiz(ctx)
        await new Promise<void>(r => setTimeout(r, 100))

        expect(ctx.reply).toHaveBeenCalledTimes(1)
        const [question, opts] = ctx.reply.mock.calls[0]
        expect(question).toBe('Test question?')
        const kb = opts.reply_markup.inline_keyboard
        expect(kb).toHaveLength(4)
        expect(kb[0][0].text).toBe('A')
        expect(kb[0][0].callback_data).toBe(`ans:${quiz._id.toString()}:0`)
        expect(kb[3][0].callback_data).toBe(`ans:${quiz._id.toString()}:3`)
    })

    it('persists quizId and quizExpiresAt after sending', async () => {
        await getOrCreateUser(9999)
        await getOrCreateUser(1001)
        const quiz = await createQuizInDb()
        const ctx = makeQuizCtx(quiz._id)

        await sendQuiz(ctx)
        await new Promise<void>(r => setTimeout(r, 100))

        expect(ctx.dbuser.quizId.toString()).toBe(quiz._id.toString())
        expect(ctx.dbuser.quizMessageId).toBe(42)
        expect(ctx.dbuser.quizExpiresAt).toBeInstanceOf(Date)
    })

    it('arms the expiry timer unref()ed and survives a missing user', async () => {
        await getOrCreateUser(9999)
        await getOrCreateUser(1001)
        const quiz = await createQuizInDb()
        const ctx = makeQuizCtx(quiz._id)

        const spy = jest.spyOn(global, 'setTimeout')
        await sendQuiz(ctx)
        await new Promise<void>(r => setTimeout(r, 100))

        const calls = spy.mock.calls as unknown as any[][]
        const idx = calls.findIndex(c => typeof c[1] === 'number' && c[1] >= 9000)
        expect(idx).toBeGreaterThanOrEqual(0)
        const timer = spy.mock.results[idx].value as NodeJS.Timeout
        expect(timer.hasRef()).toBe(false)

        const [callback, , _userIdArg, chatIdArg, messageIdArg, quizIdArg] = calls[idx]
        spy.mockRestore()
        clearTimeout(timer)

        const unhandled: unknown[] = []
        const onUnhandled = (reason: unknown) => unhandled.push(reason)
        process.on('unhandledRejection', onUnhandled)
        ;(callback as Function)(424242, chatIdArg, messageIdArg, quizIdArg)
        await new Promise<void>(r => setTimeout(r, 300))
        process.off('unhandledRejection', onUnhandled)
        expect(unhandled).toHaveLength(0)
    })
})
