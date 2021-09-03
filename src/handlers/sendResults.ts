import { VIZ } from "@/helpers/viz"
import { getAllBalances } from "@/models"
import { Context } from "telegraf"

const viz = new VIZ()

export async function sendResults(ctx: Context) {
    const account = process.env.ACCOUNT
    let user = await viz.getAccount(account)
    let allVIZes = parseFloat(user['balance'])
    let allBalances = await getAllBalances()
    let price = allVIZes / allBalances
    let userVIZes = ctx.dbuser.balance * price
    let withdrowalable = userVIZes > 11
    let payload = {
        balance: ctx.dbuser.balance,
        viz: userVIZes,
        withdrowalable: withdrowalable
    } 
    ctx.reply(ctx.i18n.t('results', payload),
        { parse_mode: 'HTML', disable_web_page_preview: true })
}
