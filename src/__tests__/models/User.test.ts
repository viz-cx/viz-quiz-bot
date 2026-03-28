import * as db from '../setup/db'
import { UserModel, findUser, getOrCreateUser, addToBalance } from '@/models/User'
import { SectionModel } from '@/models/Section'

// ─── lifecycle ───────────────────────────────────────────────────────────────
beforeAll(() => db.connect())
afterAll(() => db.disconnect())
afterEach(() => db.clear())

// ─── getOrCreateUser ─────────────────────────────────────────────────────────
describe('getOrCreateUser', () => {
    it('creates a new user if one does not exist', async () => {
        const user = await getOrCreateUser(555)
        expect(user).not.toBeNull()
        expect(user!.id).toBe(555)
        expect(user!.balance).toBe(0)
        expect(user!.multiplier).toBe(0)
    })

    it('returns the existing user on the second call (no duplicate)', async () => {
        await getOrCreateUser(555)
        await getOrCreateUser(555)
        const count = await UserModel.countDocuments({ id: 555 })
        expect(count).toBe(1)
    })
})

// ─── findUser ─────────────────────────────────────────────────────────────────
describe('findUser', () => {
    it('returns null for an unknown id', async () => {
        const result = await findUser(99999)
        expect(result).toBeNull()
    })

    it('finds an existing user by telegram id', async () => {
        await getOrCreateUser(777)
        const user = await findUser(777)
        expect(user).not.toBeNull()
        expect(user!.id).toBe(777)
    })
})

// ─── addToBalance ─────────────────────────────────────────────────────────────
describe('addToBalance', () => {
    it('increments the balance of an existing user', async () => {
        await getOrCreateUser(111)
        await addToBalance(111, 500)
        const user = await findUser(111)
        expect(user!.balance).toBe(500)
    })

    it('accumulates multiple additions', async () => {
        await getOrCreateUser(111)
        await addToBalance(111, 100)
        await addToBalance(111, 250)
        const user = await findUser(111)
        expect(user!.balance).toBe(350)
    })

    it('upserts — creates the user record if it does not exist', async () => {
        await addToBalance(222, 1000)
        const user = await findUser(222)
        expect(user!.balance).toBe(1000)
    })
})

// ─── activeTopicSection ───────────────────────────────────────────────────────
describe('User.activeTopicSection', () => {
    it('is undefined by default', async () => {
        const user = await getOrCreateUser(333)
        expect(user!.activeTopicSection).toBeUndefined()
    })

    it('can be set to a Section reference and persisted', async () => {
        const section = await SectionModel.create({
            title: 'My Topic',
            authorId: 1,
            isPublic: true,
            quizzes: [],
        })
        const user = await getOrCreateUser(333)
        user!.activeTopicSection = section as any
        await user!.save()

        const reloaded = await findUser(333)
        expect(reloaded!.activeTopicSection).not.toBeUndefined()
        expect(reloaded!.activeTopicSection!.toString()).toBe(section._id.toString())
    })

    it('can be cleared back to undefined', async () => {
        const section = await SectionModel.create({
            title: 'Temp Topic',
            authorId: 1,
            isPublic: true,
            quizzes: [],
        })
        const user = await getOrCreateUser(444)
        user!.activeTopicSection = section as any
        await user!.save()

        user!.activeTopicSection = undefined
        await user!.save()

        const reloaded = await findUser(444)
        expect(reloaded!.activeTopicSection).toBeUndefined()
    })
})

// ─── defaults ─────────────────────────────────────────────────────────────────
describe('User defaults', () => {
    it('starts with an empty answered array', async () => {
        const user = await getOrCreateUser(555)
        expect(user!.answered).toHaveLength(0)
    })

    it('starts with difficulty = Normal (1)', async () => {
        const user = await getOrCreateUser(555)
        expect(user!.difficulty).toBe(1)
    })

    it('starts with language = ru', async () => {
        const user = await getOrCreateUser(555)
        expect(user!.language).toBe('ru')
    })
})
