import { VIZ } from "./helpers/viz"

export function startUnstaking() {
    setTimeout(() => {
        console.log("Start unstaking")
        unstake()
        startUnstaking()
    }, 60 * 60 * 24 * 1000 + 600)
}

function unstake() {
    const from = process.env.ACCOUNT
    const wif = process.env.WIF
    const fixedBalance = parseFloat(process.env.BALANCE)
    VIZ.origin.unstakeExcessShares(from, wif, fixedBalance)
        .then(result => console.log(result['operations'][0][1]))
        .catch(_ => console.error("Unsuccessful vesting withdrawal!"))
}
