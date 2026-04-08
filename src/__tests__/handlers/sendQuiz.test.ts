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
