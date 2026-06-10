import { VIZ } from "./helpers/viz"

export async function startSelfAwarding() {
    const hours = randomFromInterval(5, 50)
    setTimeout(() => {
        makeSelfAward()
        startSelfAwarding()
    }, 1000 * 60 * 60 * hours)
}

/**
 * Chain timestamps come without a 'Z' suffix, so Date.parse treats them as
 * local time — the getTimezoneOffset() term cancels that out.
 */
export function computeRegeneratedEnergy(currentEnergy: number, lastVoteTime: string, now: Date = new Date()): number {
    const lastVote = Date.parse(lastVoteTime)
    const deltaSeconds = (now.getTime() - lastVote + (now.getTimezoneOffset() * 60000)) / 1000
    // CHAIN_ENERGY_REGENERATION_SECONDS = 432000 (5 days)
    const newEnergy = Math.floor(currentEnergy + (deltaSeconds * 10000 / 432000))
    return Math.min(newEnergy, 10000)
}

export async function makeSelfAward() {
    const account = process.env.ACCOUNT
    const wif = process.env.WIF
    try {
        const data = await VIZ.origin.getAccount(account)
        const energy = data['energy']
        const newEnergy = computeRegeneratedEnergy(energy, data['last_vote_time'])
        console.log("Make self award with energy", newEnergy)
        await VIZ.origin.award(account, account, wif, newEnergy, "", null, account)
    } catch (_) {
        VIZ.origin.changeNode()
    }
}

function randomFromInterval(min: number, max: number) { // min and max included
    return Math.floor(Math.random() * (max - min + 1) + min)
}
