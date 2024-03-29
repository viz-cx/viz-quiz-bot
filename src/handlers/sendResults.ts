import { Emoji } from "@/helpers/keyboard"
import { getAllBalances } from "@/models"
import { Context, Markup } from "telegraf"
import { ExtraReplyMessage } from "telegraf/typings/telegram-types"

export async function sendResults(ctx: Context) {
    const account = process.env.ACCOUNT
    let user = await ctx.viz.getAccount(account)
        .catch(_ => ctx.viz.changeNode())
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
        viz: userVIZes.toFixed(2),
        withdrowalable: withdrowalable
    }
    let hideButton = !withdrowalable
    let markup = Markup.inlineKeyboard([
        Markup.button.callback(Emoji.Cheque + ' ' + ctx.i18n.t('withdrowal'), Emoji.Cheque, hideButton)
    ]).reply_markup
    let extra: ExtraReplyMessage = {
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        reply_markup: markup
    }
    ctx.reply(ctx.i18n.t('results', payload), extra)
}
