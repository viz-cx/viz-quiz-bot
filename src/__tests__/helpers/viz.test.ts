/**
 * Tests for the VIZ blockchain helper.
 *
 * generateWif() produces the private key for money-bearing cheques —
 * it must use cryptographically secure randomness, never Math.random().
 */
import { VIZ } from '@/helpers/viz'

describe('VIZ.generateWif', () => {
    it('does not use Math.random for key material', () => {
        const spy = jest.spyOn(Math, 'random')
        VIZ.origin.generateWif()
        expect(spy).not.toHaveBeenCalled()
        spy.mockRestore()
    })

    it('produces a valid WIF convertible to a public key', () => {
        const wif = VIZ.origin.generateWif()
        expect(typeof wif).toBe('string')
        expect(wif.length).toBeGreaterThan(0)
        const publicKey = VIZ.origin.wifToPublic(wif)
        expect(typeof publicKey).toBe('string')
        expect(publicKey.length).toBeGreaterThan(0)
    })

    it('produces unique keys on every call', () => {
        const wifs = new Set(Array.from({ length: 10 }, () => VIZ.origin.generateWif()))
        expect(wifs.size).toBe(10)
    })
})
