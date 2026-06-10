/**
 * Tests for the selfAward background task.
 *
 * The chain returns last_vote_time as a UTC clock string WITHOUT a 'Z'
 * suffix (e.g. '2020-01-01T00:00:00'); the timezone-offset compensation in
 * the energy computation accounts for Date.parse treating it as local time.
 */
import { computeRegeneratedEnergy, makeSelfAward } from '@/selfAward'
import { VIZ } from '@/helpers/viz'

/** Format an epoch-ms instant the way the chain does: UTC clock, no 'Z'. */
function chainTime(epochMs: number): string {
    return new Date(epochMs).toISOString().slice(0, 19)
}

const DAY_MS = 24 * 60 * 60 * 1000

describe('computeRegeneratedEnergy', () => {
    const now = new Date('2026-06-10T12:00:00Z')

    it('fully regenerates to 10000 after 5+ idle days', () => {
        expect(computeRegeneratedEnergy(0, chainTime(now.getTime() - 10 * DAY_MS), now)).toBe(10000)
    })

    it('regenerates 2000 energy per idle day', () => {
        // 10000 energy over 432000s (5 days) => 2000/day
        expect(computeRegeneratedEnergy(5000, chainTime(now.getTime() - 1 * DAY_MS), now)).toBe(7000)
    })

    it('clamps at the 10000 cap', () => {
        expect(computeRegeneratedEnergy(9500, chainTime(now.getTime() - 2 * DAY_MS), now)).toBe(10000)
    })
})

describe('makeSelfAward', () => {
    beforeAll(() => {
        process.env.ACCOUNT = 'test-account'
        process.env.WIF = 'test-wif'
    })
    afterEach(() => jest.restoreAllMocks())

    it('awards with the regenerated energy, not the stale account energy', async () => {
        const account = {
            last_vote_time: chainTime(Date.now() - 10 * DAY_MS), // fully regenerated
            energy: 5000,
        }
        jest.spyOn(VIZ.origin, 'getAccount').mockResolvedValue(account)
        const awardSpy = jest.spyOn(VIZ.origin, 'award').mockResolvedValue('ok')

        await makeSelfAward()

        expect(awardSpy).toHaveBeenCalledTimes(1)
        // award(receiver, from, wif, energy, ...)
        expect(awardSpy.mock.calls[0][3]).toBe(10000)
    })
})
