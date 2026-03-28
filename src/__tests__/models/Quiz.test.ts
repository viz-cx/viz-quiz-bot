import { mongoose } from '@typegoose/typegoose'
import * as db from '../setup/db'
import { QuizModel, findUnansweredQuizzesInSection, getQuizCountBySection } from '@/models/Quiz'
import { SectionModel } from '@/models/Section'

// ─── lifecycle ───────────────────────────────────────────────────────────────
beforeAll(() => db.connect())
afterAll(() => db.disconnect())
afterEach(() => db.clear())

// ─── helpers ─────────────────────────────────────────────────────────────────
async function createQuiz(
    question: string,
    authorId: number,
    sectionId?: mongoose.Types.ObjectId
) {
    return QuizModel.create({
        question,
        answers: ['correct', 'wrong1', 'wrong2'],
        authorId,
        sectionId,
    })
}

async function createSection(title: string, authorId: number) {
    return SectionModel.create({ title, authorId, isPublic: false, quizzes: [] })
}

// ─── getQuizCountBySection ────────────────────────────────────────────────────
describe('getQuizCountBySection', () => {
    it('returns 0 when the section has no quizzes', async () => {
        const sid = new mongoose.Types.ObjectId()
        const count = await getQuizCountBySection(sid)
        expect(count).toBe(0)
    })

    it('counts only quizzes belonging to the given section', async () => {
        const sid1 = new mongoose.Types.ObjectId()
        const sid2 = new mongoose.Types.ObjectId()

        await createQuiz('Q1', 1, sid1)
        await createQuiz('Q2', 1, sid1)
        await createQuiz('Q3', 1, sid2)

        expect(await getQuizCountBySection(sid1)).toBe(2)
        expect(await getQuizCountBySection(sid2)).toBe(1)
    })

    it('does not count quizzes that have no sectionId', async () => {
        const sid = new mongoose.Types.ObjectId()
        await createQuiz('No section', 1, undefined)
        const count = await getQuizCountBySection(sid)
        expect(count).toBe(0)
    })
})

// ─── findUnansweredQuizzesInSection ──────────────────────────────────────────
describe('findUnansweredQuizzesInSection', () => {
    it('returns all quizzes in the section when none are answered', async () => {
        const sid = new mongoose.Types.ObjectId()
        await createQuiz('Q1', 1, sid)
        await createQuiz('Q2', 1, sid)

        const result = await findUnansweredQuizzesInSection(sid, [])
        // aggregate returns an array at runtime
        expect(Array.isArray(result)).toBe(true)
        expect((result as unknown as any[]).length).toBe(2)
    })

    it('excludes already-answered quiz ids', async () => {
        const sid = new mongoose.Types.ObjectId()
        const q1 = await createQuiz('Q1', 1, sid)
        const q2 = await createQuiz('Q2', 1, sid)
        await createQuiz('Q3', 1, sid)

        const answeredIds = [q1._id, q2._id] as mongoose.Types.ObjectId[]
        const result = await findUnansweredQuizzesInSection(sid, answeredIds)
        expect(Array.isArray(result)).toBe(true)
        const arr = result as unknown as any[]
        expect(arr.length).toBe(1)
        expect(arr[0].question).toBe('Q3')
    })

    it('returns an empty array when all quizzes are answered', async () => {
        const sid = new mongoose.Types.ObjectId()
        const q1 = await createQuiz('Q1', 1, sid)

        const result = await findUnansweredQuizzesInSection(sid, [q1._id] as any)
        expect(Array.isArray(result)).toBe(true)
        expect((result as unknown as any[]).length).toBe(0)
    })

    it('does not return quizzes from other sections', async () => {
        const sid1 = new mongoose.Types.ObjectId()
        const sid2 = new mongoose.Types.ObjectId()
        await createQuiz('Q-in-sid1', 1, sid1)
        await createQuiz('Q-in-sid2', 1, sid2)

        const result = await findUnansweredQuizzesInSection(sid1, [])
        const arr = result as unknown as any[]
        expect(arr.every((q: any) => q.sectionId.toString() === sid1.toString())).toBe(true)
    })

    it('respects the $sample size cap (max 10)', async () => {
        const sid = new mongoose.Types.ObjectId()
        // Create 15 quizzes
        for (let i = 0; i < 15; i++) {
            await createQuiz(`Q${i}`, 1, sid)
        }
        const result = await findUnansweredQuizzesInSection(sid, [])
        expect((result as unknown as any[]).length).toBeLessThanOrEqual(10)
    })
})
