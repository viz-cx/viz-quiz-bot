import * as db from '../setup/db'
import { SectionModel, getPublicSections, findSection } from '@/models/Section'

// ─── lifecycle ───────────────────────────────────────────────────────────────
beforeAll(() => db.connect())
afterAll(() => db.disconnect())
afterEach(() => db.clear())

// ─── helpers ─────────────────────────────────────────────────────────────────
async function createSection(
    title: string,
    authorId: number,
    isPublic: boolean,
    description?: string
) {
    return SectionModel.create({ title, authorId, isPublic, quizzes: [], description })
}

// ─── isPublic field ───────────────────────────────────────────────────────────
describe('Section.isPublic', () => {
    it('defaults to false when not provided', async () => {
        const s = await SectionModel.create({ title: 'Private', authorId: 1, quizzes: [] })
        expect(s.isPublic).toBe(false)
    })

    it('can be set to true', async () => {
        const s = await createSection('Public', 1, true)
        expect(s.isPublic).toBe(true)
    })

    it('can be toggled via save()', async () => {
        const s = await createSection('Toggle', 1, false)
        s.isPublic = true
        await s.save()
        const fetched = await SectionModel.findById(s._id)
        expect(fetched!.isPublic).toBe(true)
    })
})

// ─── description field ────────────────────────────────────────────────────────
describe('Section.description', () => {
    it('is optional and can be undefined', async () => {
        const s = await createSection('No desc', 1, false)
        expect(s.description).toBeUndefined()
    })

    it('stores a provided description', async () => {
        const s = await createSection('With desc', 1, false, 'All about cats')
        expect(s.description).toBe('All about cats')
    })
})

// ─── getPublicSections ────────────────────────────────────────────────────────
describe('getPublicSections', () => {
    it('returns an empty array when no public sections exist', async () => {
        await createSection('Private', 1, false)
        const result = await getPublicSections()
        expect(result).toHaveLength(0)
    })

    it('returns only sections with isPublic = true', async () => {
        await createSection('Private A', 1, false)
        await createSection('Public B', 2, true)
        await createSection('Public C', 3, true)

        const result = await getPublicSections()
        expect(result).toHaveLength(2)
        result.forEach(s => expect(s.isPublic).toBe(true))
    })

    it('is sorted newest first (by updatedAt desc)', async () => {
        const s1 = await createSection('First', 1, true)
        // Small delay so updatedAt timestamps differ
        await new Promise(r => setTimeout(r, 20))
        const s2 = await createSection('Second', 2, true)

        const result = await getPublicSections()
        expect(result[0]._id.toString()).toBe(s2._id.toString())
        expect(result[1]._id.toString()).toBe(s1._id.toString())
    })

    it('does not return private sections alongside public ones', async () => {
        await createSection('Public', 1, true)
        await createSection('Private', 2, false)
        const result = await getPublicSections()
        expect(result).toHaveLength(1)
        expect(result[0].title).toBe('Public')
    })
})

// ─── findSection ─────────────────────────────────────────────────────────────
describe('findSection', () => {
    it('finds a section by its string id', async () => {
        const s = await createSection('Found', 1, false)
        const result = await findSection(s._id.toString())
        expect(result).not.toBeNull()
        expect(result!.title).toBe('Found')
    })

    it('returns null for a non-existent id', async () => {
        const { mongoose } = await import('@typegoose/typegoose')
        const fakeId = new mongoose.Types.ObjectId().toString()
        const result = await findSection(fakeId)
        expect(result).toBeNull()
    })
})
