import { VIZ } from "./helpers/viz"

const viz = new VIZ()

export function startSelfAwarding() {
    const hours = 5
    setTimeout(() => {
        makeSelfAward()
        startSelfAwarding()
    }, 1000 * 60 * 60 * hours)
}

function makeSelfAward() {
    const account = process.env.ACCOUNT
    const wif = process.env.WIF
    viz.getAccount(account).then(data => {
        let last_vote_time = Date.parse(data['last_vote_time'])
        let delta_time = (new Date().getTime() - last_vote_time + (new Date().getTimezoneOffset() * 60000)) / 1000
        let energy = data['energy']
        let new_energy = parseInt(energy + (delta_time * 10000 / 432000)) //CHAIN_ENERGY_REGENERATION_SECONDS 5 days
        if (new_energy > 10000) {
            new_energy = 10000
        }
        console.log("Make self award with energy", energy)
        viz.award(account, account, wif, energy, "", null, account).catch(_ => viz.changeNode())
    })
}
