import { VIZ } from "@/helpers/viz"
import { getAllBalances } from "@/models"
import { Context, Markup } from "telegraf"
import { ExtraReplyMessage } from "telegraf/typings/telegram-types"

const viz = new VIZ()

export async function sendResults(ctx: Context) {
    const account = process.env.ACCOUNT
    let user = await viz.getAccount(account)
    let allVIZes = parseFloat(user['balance'])
    let allBalances = await getAllBalances()
    let price: number
    if (allBalances === 0) {
        price = 0
    } else {
        price = allVIZes / allBalances
    }
    let userVIZes = ctx.dbuser.balance * price
    let withdrowalable = userVIZes > 10
    let payload = {
        balance: ctx.dbuser.balance,
        viz: userVIZes,
        withdrowalable: withdrowalable
    }
    let extra: ExtraReplyMessage
    if (withdrowalable) {
        let markup = Markup.inlineKeyboard([
            Markup.button.callback('💰 ' + ctx.i18n.t('withdrowal'), '💰', false)
        ]).reply_markup
        extra = {
            parse_mode: 'HTML',
            disable_web_page_preview: true,
            reply_markup: markup
        }
        ctx.reply(ctx.i18n.t('results', payload), extra)
    } else {
        extra = {
            parse_mode: 'HTML',
            disable_web_page_preview: true
        }
        ctx.reply(ctx.i18n.t('results', payload), extra)
    }
}
