import { Emoji } from "@/helpers/keyboard"
import { getAllBalances } from "@/models"
import { MyContext } from "@/types/context"
import { InlineKeyboard } from "grammy"

export async function sendResults(ctx: MyContext) {
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
    const kb = new InlineKeyboard()
    if (withdrowalable) {
        kb.text(Emoji.Cheque + ' ' + ctx.i18n.t('withdrowal'), Emoji.Cheque)
    }
    ctx.reply(ctx.i18n.t('results', payload), {
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
        reply_markup: kb
    })
}
