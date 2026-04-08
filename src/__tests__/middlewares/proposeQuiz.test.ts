import { mongoose } from '@typegoose/typegoose'
import * as db from '../setup/db'
import { makeCtx } from '../setup/contextFactory'
import { proposeQuiz } from '@/middlewares/proposeQuiz'
import { QuizModel } from '@/models/Quiz'
import { getOrCreateUser } from '@/models/User'
import { SectionModel } from '@/models/Section'

beforeAll(() => db.connect())
afterAll(() => db.disconnect())
afterEach(() => db.clear())

// Suppress console.log in tests
beforeEach(() => jest.spyOn(console, 'log').mockImplementation())
afterEach(() => jest.restoreAllMocks())

async function createSection(authorId: number) {
    return SectionModel.create({ title: 'Test Section', authorId })
}

function makePollMessage(poll: any, fromId: number) {
    return {
        poll,
        from: { id: fromId },
    }
}

describe('proposeQuiz — guard clauses', () => {
    it('calls next() when ctx.message is undefined', async () => {
        const ctx = makeCtx()
        ctx.message = undefined
        const next = jest.fn()
        await proposeQuiz(ctx, next)
        expect(next).toHaveBeenCalled()
    })

    it('calls next() when message has no poll', async () => {
        const ctx = makeCtx({ message: { from: { id: 1 } } })
        const next = jest.fn()
        await proposeQuiz(ctx, next)
        expect(next).toHaveBeenCalled()
    })

    it('replies not_quiz for regular (non-quiz) polls', async () => {
        const ctx = makeCtx({
            message: makePollMessage({ type: 'regular', id: 'p1', options: [] }, 1),
        })
        const next = jest.fn()
        await proposeQuiz(ctx, next)
        expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('not_quiz'))
    })

    it('replies already_added for duplicate poll', async () => {
        const user = await getOrCreateUser(100)
        const section = await createSection(100)
        await QuizModel.create({
            question: 'Q?',
            answers: ['A', 'B'],
            correctAnswerIndices: [0],
            authorId: 100,
            pollId: 'dup-poll',
            sectionId: section._id,
        })

        const ctx = makeCtx({
            dbuser: { id: 100, selectedSection: section._id } as any,
            message: makePollMessage({
                type: 'quiz',
                id: 'dup-poll',
                correct_option_ids: [0],
                options: [{ text: 'A' }, { text: 'B' }],
            }, 100),
        })
        await proposeQuiz(ctx, jest.fn())
        expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('already_added'))
    })
})

describe('proposeQuiz — single correct import', () => {
    it('saves quiz with single correct_option_ids', async () => {
        const user = await getOrCreateUser(200)
        const section = await createSection(200)

        const ctx = makeCtx({
            dbuser: { id: 200, selectedSection: section._id } as any,
            message: makePollMessage({
                type: 'quiz',
                id: 'single-poll',
                question: 'What is 1+1?',
                correct_option_ids: [1],
                explanation: 'Simple math',
                options: [{ text: 'One' }, { text: 'Two' }, { text: 'Three' }],
            }, 200),
        })
        ctx.forwardMessage = jest.fn().mockResolvedValue(undefined)

        await proposeQuiz(ctx, jest.fn())

        const quiz = await QuizModel.findOne({ pollId: 'single-poll' })
        expect(quiz).not.toBeNull()
        expect(quiz.question).toBe('What is 1+1?')
        expect([...quiz.answers]).toEqual(['One', 'Two', 'Three'])
        expect([...quiz.correctAnswerIndices]).toEqual([1])
        expect(quiz.explanation).toBe('Simple math')
    })
})

describe('proposeQuiz — legacy correct_option_id (singular)', () => {
    it('falls back to correct_option_id when correct_option_ids is missing', async () => {
        const user = await getOrCreateUser(250)
        const section = await createSection(250)

        const ctx = makeCtx({
            dbuser: { id: 250, selectedSection: section._id } as any,
            message: makePollMessage({
                type: 'quiz',
                id: 'legacy-poll',
                question: 'Legacy quiz?',
                correct_option_id: 2,
                options: [{ text: 'A' }, { text: 'B' }, { text: 'C' }],
            }, 250),
        })
        ctx.forwardMessage = jest.fn().mockResolvedValue(undefined)

        await proposeQuiz(ctx, jest.fn())

        const quiz = await QuizModel.findOne({ pollId: 'legacy-poll' })
        expect(quiz).not.toBeNull()
        expect([...quiz.correctAnswerIndices]).toEqual([2])
    })
})

describe('proposeQuiz — no correct answer data', () => {
    it('defaults to [0] when neither correct_option_ids nor correct_option_id is present', async () => {
        const user = await getOrCreateUser(260)
        const section = await createSection(260)

        const ctx = makeCtx({
            dbuser: { id: 260, selectedSection: section._id } as any,
            message: makePollMessage({
                type: 'quiz',
                id: 'no-answer-poll',
                question: 'No answer data?',
                options: [{ text: 'A' }, { text: 'B' }],
            }, 260),
        })
        ctx.forwardMessage = jest.fn().mockResolvedValue(undefined)

        await proposeQuiz(ctx, jest.fn())

        const quiz = await QuizModel.findOne({ pollId: 'no-answer-poll' })
        expect(quiz).not.toBeNull()
        expect([...quiz.correctAnswerIndices]).toEqual([0])
    })
})

describe('proposeQuiz — multi-correct import', () => {
    it('saves quiz with multiple correct_option_ids', async () => {
        const user = await getOrCreateUser(300)
        const section = await createSection(300)

        const ctx = makeCtx({
            dbuser: { id: 300, selectedSection: section._id } as any,
            message: makePollMessage({
                type: 'quiz',
                id: 'multi-poll',
                question: 'Which are even?',
                correct_option_ids: [0, 2],
                description: 'Select all even numbers',
                options: [{ text: '2' }, { text: '3' }, { text: '4' }, { text: '5' }],
            }, 300),
        })
        ctx.forwardMessage = jest.fn().mockResolvedValue(undefined)

        await proposeQuiz(ctx, jest.fn())

        const quiz = await QuizModel.findOne({ pollId: 'multi-poll' })
        expect(quiz).not.toBeNull()
        expect([...quiz.answers]).toEqual(['2', '3', '4', '5'])
        expect([...quiz.correctAnswerIndices]).toEqual([0, 2])
        expect(quiz.description).toBe('Select all even numbers')
    })
})
