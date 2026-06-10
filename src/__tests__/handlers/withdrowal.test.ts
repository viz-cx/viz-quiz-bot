/**
 * Tests for the makeCheque withdrawal handler.
 *
 * Strategy:
 *  - Real in-memory MongoDB so getAllBalances() aggregates real documents.
 *  - ctx.viz is a mock — no blockchain calls in tests.
 */
import * as db from '../setup/db'
import { makeCtx } from '../setup/contextFactory'
import { makeCheque } from '@/handlers/withdrowal'
import { UserModel } from '@/models/User'

beforeAll(async () => {
    process.env.ACCOUNT = 'test-account'
    process.env.WIF = 'test-wif'
    await db.connect()
})
afterAll(() => db.disconnect())
afterEach(() => db.clear())

async function flush(ms = 150) {
    await new Promise<void>(resolve => setTimeout(resolve, ms))
}

function makeVizMock() {
    return {
        getAccount: jest.fn().mockResolvedValue({ balance: '100.000 VIZ' }),
        changeNode: jest.fn(),
        generateWif: jest.fn(() => 'PRIVATE-WIF'),
        wifToPublic: jest.fn(() => 'PUBLIC-KEY'),
        createInvite: jest.fn().mockResolvedValue({}),
    }
}

/**
 * One DB user holds all 100 points => price = 100 VIZ / 100 points = 1.
 * ctx.dbuser.balance = 50 => userVIZes = 50, well above the 10 VIZ minimum.
 */
async function buildScenario(balance = 50) {
    await UserModel.create({ id: 9001, balance: 100 })
    const resetedAt = new Date('2020-01-01')
    const ctx = makeCtx({
        dbuser: { id: 9001, balance, multiplier: 7, resetedAt } as any,
        callbackQuery: { data: 'cheque', message: { message_id: 1 } },
    })
    ctx.viz = makeVizMock()
    return { ctx, resetedAt }
}

describe('makeCheque — node failure', () => {
    it('replies gracefully and keeps balance when getAccount fails', async () => {
        const { ctx } = await buildScenario()
        ctx.viz.getAccount.mockRejectedValue(new Error('node down'))

        await expect(makeCheque(ctx as any)).resolves.not.toThrow()
        await flush()

        expect(ctx.viz.changeNode).toHaveBeenCalled()
        expect(ctx.dbuser.balance).toBe(50)
        expect(ctx.dbuser.save).not.toHaveBeenCalled()
        expect(ctx.viz.createInvite).not.toHaveBeenCalled()
        const replies = ctx.answerCallbackQuery.mock.calls.map((c: any[]) => c[0]?.text)
        expect(replies).toContain('something_wrong')
    })
})

describe('makeCheque — createInvite failure', () => {
    it('restores balance, multiplier and resetedAt when the invite fails', async () => {
        const { ctx, resetedAt } = await buildScenario()
        ctx.viz.createInvite.mockRejectedValue(new Error('broadcast failed'))

        await makeCheque(ctx as any)
        await flush()

        expect(ctx.dbuser.balance).toBe(50)
        expect(ctx.dbuser.multiplier).toBe(7)
        expect(ctx.dbuser.resetedAt).toBe(resetedAt)
        const replies = ctx.reply.mock.calls.map((c: any[]) => c[0])
        expect(replies).toContain('something_wrong')
    })
})

describe('makeCheque — success path', () => {
    it('zeroes the balance and sends the cheque', async () => {
        const { ctx } = await buildScenario()

        await makeCheque(ctx as any)
        await flush()

        expect(ctx.viz.createInvite).toHaveBeenCalledWith(
            'test-wif', 'test-account', '50.000 VIZ', 'PUBLIC-KEY')
        expect(ctx.dbuser.balance).toBe(0)
        expect(ctx.dbuser.multiplier).toBe(0)
        const replies = ctx.reply.mock.calls.map((c: any[]) => c[0])
        expect(replies).toContain('cheque')
    })
})

describe('makeCheque — below minimum', () => {
    it('rejects withdrawal under 10 VIZ and keeps balance', async () => {
        const { ctx } = await buildScenario(5) // 5 VIZ worth

        await makeCheque(ctx as any)
        await flush()

        expect(ctx.dbuser.balance).toBe(5)
        expect(ctx.viz.createInvite).not.toHaveBeenCalled()
        const replies = ctx.answerCallbackQuery.mock.calls.map((c: any[]) => c[0]?.text)
        expect(replies).toContain('not_enough')
    })
})
