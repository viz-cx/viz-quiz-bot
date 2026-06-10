import { mongoose } from '@typegoose/typegoose'
import * as db from '../setup/db'
import { makeCtx } from '../setup/contextFactory'
import { sendQuiz } from '@/handlers/sendQuiz'
import { QuizModel } from '@/models/Quiz'
import { getOrCreateUser } from '@/models/User'
import { Difficulty } from '@/models/User'

beforeAll(() => db.connect())
afterAll(() => db.disconnect())
afterEach(() => db.clear())

async function createQuizInDb(opts: {
    correctAnswerIndices?: number[]
    description?: string
    answers?: string[]
} = {}) {
    return QuizModel.create({
        question: 'Test question?',
        answers: opts.answers ?? ['Right', 'Wrong1', 'Wrong2'],
        correctAnswerIndices: opts.correctAnswerIndices ?? [0],
        description: opts.description,
        explanation: 'Because yes',
        authorId: 9999,
    })
}

function makeQuizCtx(quizId: any, difficulty: Difficulty = Difficulty.Normal) {
    const ctx = makeCtx({
        dbuser: {
            id: 1001,
            balance: 0,
            multiplier: 0,
            difficulty,
            answered: [],
            quizId: null,
            pollId: null,
            quizMessageId: null,
            activeTopicSection: undefined,
        } as any,
    })
    // Mock replyWithPoll to return poll-like response
    ctx.replyWithPoll = jest.fn().mockResolvedValue({
        message_id: 42,
        poll: { id: 'poll-42' },
    })
    ctx.dbuser.save = jest.fn().mockResolvedValue(undefined)
    return ctx
}

// --- async robustness ---
describe('sendQuiz — async robustness', () => {
    async function scheduleCloseTimer() {
        await getOrCreateUser(9999)
        await getOrCreateUser(1001)
        const quiz = await createQuizInDb()
        const ctx = makeQuizCtx(quiz._id)

        const spy = jest.spyOn(global, 'setTimeout')
        await sendQuiz(ctx)
        // Let the replyWithPoll .then chain run and schedule the timer
        await new Promise<void>(r => setTimeout(r, 100))
        // The close-poll timer is the only long one (>= 9s; Nightmare is shortest at 10s)
        const calls = spy.mock.calls as unknown as any[][]
        const idx = calls.findIndex(c => typeof c[1] === 'number' && c[1] >= 9000)
        const call = idx >= 0 ? calls[idx] : null
        const timer = idx >= 0 ? (spy.mock.results[idx].value as NodeJS.Timeout) : null
        spy.mockRestore()
        if (timer) clearTimeout(timer)
        return { call, timer }
    }

    it('schedules the poll-close timer unref()ed so it cannot block process exit', async () => {
        const { timer } = await scheduleCloseTimer()
        expect(timer).not.toBeNull()
        expect(timer!.hasRef()).toBe(false)
    })

    it('does not leave unhandled rejections when the timer fires for a missing user', async () => {
        const { call } = await scheduleCloseTimer()
        expect(call).not.toBeNull()
        const [callback, , , quizId, messageId] = call!

        const unhandled: unknown[] = []
        const onUnhandled = (reason: unknown) => unhandled.push(reason)
        process.on('unhandledRejection', onUnhandled)

        // Fire the captured callback for a user that no longer exists
        ;(callback as Function)(424242, quizId, messageId)
        await new Promise<void>(r => setTimeout(r, 300))

        process.off('unhandledRejection', onUnhandled)
        expect(unhandled).toHaveLength(0)
    })
})

describe('sendQuiz — API parameters', () => {
    it('passes correct_option_ids as array for single-correct quiz', async () => {
        await getOrCreateUser(9999)
        await getOrCreateUser(1001)
        const quiz = await createQuizInDb({ correctAnswerIndices: [0] })

        const ctx = makeQuizCtx(quiz._id)

        await sendQuiz(ctx)

        expect(ctx.replyWithPoll).toHaveBeenCalledTimes(1)
        const [question, answers, options] = ctx.replyWithPoll.mock.calls[0]
        expect(question).toBe('Test question?')
        expect(options.correct_option_ids).toEqual([0])
        expect(options.allows_multiple_answers).toBe(false)
    })

    it('passes allows_multiple_answers=true for multi-correct quiz', async () => {
        await getOrCreateUser(9999)
        await getOrCreateUser(1001)
        const quiz = await createQuizInDb({ correctAnswerIndices: [0, 2] })

        const ctx = makeQuizCtx(quiz._id)

        await sendQuiz(ctx)

        const [, , options] = ctx.replyWithPoll.mock.calls[0]
        expect(options.correct_option_ids).toEqual([0, 2])
        expect(options.allows_multiple_answers).toBe(true)
    })

    it('sets shuffle_options=true', async () => {
        await getOrCreateUser(9999)
        await getOrCreateUser(1001)
        await createQuizInDb()

        const ctx = makeQuizCtx(null)

        await sendQuiz(ctx)

        const [, , options] = ctx.replyWithPoll.mock.calls[0]
        expect(options.shuffle_options).toBe(true)
    })

    it('sets hide_results_until_closes=true', async () => {
        await getOrCreateUser(9999)
        await getOrCreateUser(1001)
        await createQuizInDb()

        const ctx = makeQuizCtx(null)

        await sendQuiz(ctx)

        const [, , options] = ctx.replyWithPoll.mock.calls[0]
        expect(options.hide_results_until_closes).toBe(true)
    })

    it('passes description when quiz has one', async () => {
        await getOrCreateUser(9999)
        await getOrCreateUser(1001)
        await createQuizInDb({ description: 'Choose carefully' })

        const ctx = makeQuizCtx(null)

        await sendQuiz(ctx)

        const [, , options] = ctx.replyWithPoll.mock.calls[0]
        expect(options.description).toBe('Choose carefully')
    })

    it('omits description when quiz has none', async () => {
        await getOrCreateUser(9999)
        await getOrCreateUser(1001)
        await createQuizInDb()

        const ctx = makeQuizCtx(null)

        await sendQuiz(ctx)

        const [, , options] = ctx.replyWithPoll.mock.calls[0]
        expect(options.description).toBeUndefined()
    })

    it('passes answers in original order (no manual shuffle)', async () => {
        await getOrCreateUser(9999)
        await getOrCreateUser(1001)
        const quiz = await createQuizInDb({ answers: ['A', 'B', 'C', 'D'] })

        const ctx = makeQuizCtx(quiz._id)

        await sendQuiz(ctx)

        const [, answers] = ctx.replyWithPoll.mock.calls[0]
        expect(answers).toEqual(['A', 'B', 'C', 'D'])
    })
})
