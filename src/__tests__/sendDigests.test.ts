import * as db from './setup/db'
import { UserModel } from '@/models/User'
import { makeDigests } from '@/sendDigests'

jest.mock('@/helpers/bot', () => ({
    bot: { api: { sendMessage: jest.fn().mockResolvedValue(undefined) } }
}))

import { bot } from '@/helpers/bot'

beforeAll(() => db.connect())
afterAll(() => db.disconnect())
afterEach(() => db.clear())
afterEach(() => jest.clearAllMocks())

async function makeUser(id: number, overrides: Partial<{
    pendingAuthorIncome: number
    pendingInviterIncome: number
    digestDueAt: Date
    balance: number
}> = {}) {
    return UserModel.create({
        id,
        language: 'ru',
        balance: overrides.balance ?? 500,
        pendingAuthorIncome: overrides.pendingAuthorIncome ?? 0,
        pendingInviterIncome: overrides.pendingInviterIncome ?? 0,
        digestDueAt: overrides.digestDueAt,
    })
}

describe('makeDigests', () => {
    const past = () => new Date(Date.now() - 1000)
    const future = () => new Date(Date.now() + 100_000)
    const sendMessage = () => bot.api.sendMessage as jest.Mock

    it('sends digest for author income and resets fields', async () => {
        await makeUser(1001, { pendingAuthorIncome: 200, digestDueAt: past() })

        await makeDigests()

        expect(sendMessage()).toHaveBeenCalledTimes(1)
        const [userId, message] = sendMessage().mock.calls[0]
        expect(userId).toBe(1001)
        expect(message).toContain('200')
        expect(message).toContain('автор')
        expect(message).not.toContain('реферал')

        const user = await UserModel.findOne({ id: 1001 })
        expect(user!.pendingAuthorIncome).toBe(0)
        expect(user!.pendingInviterIncome).toBe(0)
        expect(user!.digestDueAt).toBeNull()
    })

    it('sends digest with only inviter income line', async () => {
        await makeUser(1002, { pendingInviterIncome: 100, digestDueAt: past() })

        await makeDigests()

        const [userId, message] = sendMessage().mock.calls[0]
        expect(userId).toBe(1002)
        expect(message).toContain('100')
        expect(message).toContain('реферал')
        expect(message).not.toContain('автор')
    })

    it('sends both lines when both income types are present', async () => {
        await makeUser(1003, { pendingAuthorIncome: 150, pendingInviterIncome: 80, digestDueAt: past() })

        await makeDigests()

        const [, message] = sendMessage().mock.calls[0]
        expect(message).toContain('автор')
        expect(message).toContain('реферал')
    })

    it('skips user whose digestDueAt is in the future', async () => {
        await makeUser(1004, { pendingAuthorIncome: 200, digestDueAt: future() })

        await makeDigests()

        expect(sendMessage()).not.toHaveBeenCalled()
    })

    it('skips user with past digestDueAt but zero income', async () => {
        await makeUser(1005, { pendingAuthorIncome: 0, pendingInviterIncome: 0, digestDueAt: past() })

        await makeDigests()

        expect(sendMessage()).not.toHaveBeenCalled()
    })
})
