import { VIZ } from "@/helpers/viz"
import { getAllBalances } from "@/models/User"
import { Context } from "telegraf"

const viz = new VIZ()

export async function makeCheque(ctx: Context) {
    const account = process.env.ACCOUNT
    let user = await viz.getAccount(account)
    let allVIZes = parseFloat(user['balance'])
    let allBalances = await getAllBalances()
    let price = allVIZes / allBalances
    if (allBalances === 0) {
        price = 0
    } else {
        price = allVIZes / allBalances
    }
    let userVIZes = ctx.dbuser.balance * price
    let withdrowalable = userVIZes > 10
    if (!withdrowalable) {
        ctx.answerCbQuery(ctx.i18n.t('not_enough'))
        return
    }
    let u = ctx.dbuser
    const savedBalance: number = u.balance
    u.balance = 0
    u.save().then(async u => {
        ctx.deleteMessage(ctx.callbackQuery.message.message_id)
        const account = process.env.ACCOUNT
        const wif = process.env.WIF
        const amount = '' + savedBalance.toFixed(3) + ' VIZ'
        const privateKey = viz.generateWif()
        const publicKey = viz.wifToPublic(privateKey)
        await viz.createInvite(wif, account, amount, publicKey)
            .catch(_ => console.log('Failed to create invite for', u.id, 'with', amount, 'VIZ'))
        await ctx.replyWithHTML(ctx.i18n.t('cheque', {
            viz: savedBalance.toFixed(2),
            code: privateKey
        }), { disable_web_page_preview: true })
        console.log('Successfully created cheque', privateKey, 'with balance', amount, 'for user', u.id)
    })
}
