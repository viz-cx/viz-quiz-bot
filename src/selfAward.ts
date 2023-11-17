import { VIZ } from "./helpers/viz"

export async function startSelfAwarding() {
    const hours = randomFromInterval(5, 50)
    setTimeout(() => {
        makeSelfAward()
        startSelfAwarding()
    }, 1000 * 60 * 60 * hours)
}

async function makeSelfAward() {
    const account = process.env.ACCOUNT
    const wif = process.env.WIF
    VIZ.origin.getAccount(account).then(data => {
        let last_vote_time = Date.parse(data['last_vote_time'])
        let delta_time = (new Date().getTime() - last_vote_time + (new Date().getTimezoneOffset() * 60000)) / 1000
        let energy = data['energy']
        let new_energy = parseInt(energy + (delta_time * 10000 / 432000)) //CHAIN_ENERGY_REGENERATION_SECONDS 5 days
        if (new_energy > 10000) {
            new_energy = 10000
        }
        console.log("Make self award with energy", energy)
        VIZ.origin.award(account, account, wif, energy, "", null, account).catch(_ => VIZ.origin.changeNode())
    })
}

function randomFromInterval(min, max) { // min and max included 
    return Math.floor(Math.random() * (max - min + 1) + min)
}
