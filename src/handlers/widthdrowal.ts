import { VIZ } from "@/helpers/viz"
import { getAllBalances } from "@/models/User"
import { Context } from "telegraf"

const viz = new VIZ()

export async function makeWidthdrowal(ctx: Context) {
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
    u.balance = 0
    u.save().then(u => {
        ctx.deleteMessage(ctx.callbackQuery.message.message_id)
        // TODO: create and send cheque
    })
}
