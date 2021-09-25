import { getAllBalances } from "@/models/User"
import { Context } from "telegraf"

export async function makeCheque(ctx: Context) {
    let viz = ctx.viz
    const account = process.env.ACCOUNT
    let user = await viz.getAccount(account)
        .catch(_ => ctx.viz.changeNode())
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
    u.balance = 0
    u.multiplier = 0
    u.save().then(async u => {
        try {
            ctx.deleteMessage(ctx.callbackQuery.message.message_id)
        } catch (_) {}
        const account = process.env.ACCOUNT
        const wif = process.env.WIF
        const amount = '' + userVIZes.toFixed(3) + ' VIZ'
        const privateKey = viz.generateWif()
        const publicKey = viz.wifToPublic(privateKey)
        await viz.createInvite(wif, account, amount, publicKey)
            .then(_ => {
                ctx.replyWithHTML(ctx.i18n.t('cheque', {
                    viz: userVIZes.toFixed(2),
                    code: privateKey
                }), { disable_web_page_preview: true })
                console.log('Successfully created cheque', privateKey, 'with balance', amount, 'for user', u.id)
            })
            .catch(_ => {
                ctx.reply(ctx.i18n.t('something_wrong'))
                console.log('Failed to create invite for', u.id, 'with', amount, 'VIZ')
            })
    })
}
