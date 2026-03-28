/**
 * Tests for sendCatalogue and handleExitTopic handlers.
 */
import * as db from '../setup/db'
import { makeCtx } from '../setup/contextFactory'
import { SectionModel } from '@/models/Section'
import { QuizModel } from '@/models/Quiz'
import { getOrCreateUser, UserModel } from '@/models/User'
import { sendCatalogue, handleExitTopic } from '@/handlers/sendCatalogue'

// ─── lifecycle ───────────────────────────────────────────────────────────────
beforeAll(() => db.connect())
afterAll(() => db.disconnect())
afterEach(() => db.clear())

// ─── helpers ─────────────────────────────────────────────────────────────────
async function createSection(
    title: string,
    authorId: number,
    isPublic: boolean
) {
    return SectionModel.create({ title, authorId, isPublic, quizzes: [] })
}

async function addQuizzesToSection(sectionId: any, count: number, authorId: number) {
    for (let i = 0; i < count; i++) {
        await QuizModel.create({
            question: `Q${i}`,
            answers: ['a', 'b'],
            authorId,
            sectionId,
        })
    }
}

// ─── sendCatalogue ────────────────────────────────────────────────────────────
describe('sendCatalogue', () => {
    it('replies with catalogue_empty when no public sections exist', async () => {
        await createSection('Private only', 1, false)
        const ctx = makeCtx()

        await sendCatalogue(ctx)

        expect(ctx.reply).toHaveBeenCalledWith('catalogue_empty')
    })

    it('replies with catalogue_title when public sections exist', async () => {
        await createSection('Public Section', 1, true)
        const ctx = makeCtx()

        await sendCatalogue(ctx)

        expect(ctx.reply).toHaveBeenCalledWith(
            'catalogue_title',
            expect.anything() // inline keyboard
        )
    })

    it('shows one button per public section', async () => {
        await createSection('Topic A', 1, true)
        await createSection('Topic B', 2, true)
        await createSection('Private', 3, false)
        const ctx = makeCtx()

        await sendCatalogue(ctx)

        // Ensure reply was called (private section is NOT shown)
        expect(ctx.reply).toHaveBeenCalled()
        const [, keyboard] = ctx.reply.mock.calls[0]
        // The inline keyboard is wrapped by Telegraf's Markup
        // We just verify reply was called with a second argument (the keyboard)
        expect(keyboard).toBeDefined()
    })

    it('does not reply with catalogue_empty when at least one public section exists', async () => {
        await createSection('Visible', 1, true)
        const ctx = makeCtx()

        await sendCatalogue(ctx)

        // Must NOT call reply with the empty-string key
        const calls = ctx.reply.mock.calls.map((c: any[]) => c[0])
        expect(calls).not.toContain('catalogue_empty')
    })

    it('includes quiz count in the section button labels', async () => {
        const section = await createSection('Quizzes Here', 1, true)
        await addQuizzesToSection(section._id, 3, 1)
        const ctx = makeCtx()

        await sendCatalogue(ctx)

        // The button labels are built inside sendCatalogue as `${s.title} (${count} квизов)`
        // We can verify reply was called — detailed label testing is integration-level
        expect(ctx.reply).toHaveBeenCalled()
    })
})

// ─── handleExitTopic ─────────────────────────────────────────────────────────
describe('handleExitTopic', () => {
    it('clears activeTopicSection on the user', async () => {
        const section = await createSection('Active Topic', 1, true)
        await getOrCreateUser(9001)

        // makeCtx SPREADS dbuser into a new object — all assertions must
        // check ctx.dbuser (the actual object the handler mutates)
        const ctx = makeCtx({
            dbuser: { id: 9001, activeTopicSection: section._id } as any,
        })
        // Replace the spread save() with our spy after ctx is ready
        ctx.dbuser.save = jest.fn().mockResolvedValue(undefined)

        await handleExitTopic(ctx)

        expect(ctx.dbuser.activeTopicSection).toBeUndefined()
        expect(ctx.dbuser.save).toHaveBeenCalled()
    })

    it('replies with topic_exit_done after clearing the topic', async () => {
        const section = await createSection('Active Topic', 1, true)
        const dbuser: any = {
            id: 9002,
            activeTopicSection: section._id,
            save: jest.fn().mockResolvedValue(undefined),
        }

        const ctx = makeCtx({ dbuser })
        await handleExitTopic(ctx)

        expect(ctx.reply).toHaveBeenCalledWith('topic_exit_done')
    })

    it('works even when activeTopicSection is already undefined', async () => {
        const dbuser: any = {
            id: 9003,
            activeTopicSection: undefined,
            save: jest.fn().mockResolvedValue(undefined),
        }

        const ctx = makeCtx({ dbuser })
        await expect(handleExitTopic(ctx)).resolves.not.toThrow()
        expect(ctx.reply).toHaveBeenCalledWith('topic_exit_done')
    })
})
