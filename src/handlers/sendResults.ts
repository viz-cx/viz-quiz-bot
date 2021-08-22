import { Context } from "telegraf"

export async function sendResults(ctx: Context) {
    let price = 0.01 // TODO: common account viz / all balances
    let payload = {
        balance: ctx.dbuser.balance,
        viz: ctx.dbuser.balance * price
    }
    // if (balance < 100) { написать недостаточный баланс для вывода } 
    ctx.reply(ctx.i18n.t('results', payload),
        { parse_mode: 'HTML', disable_web_page_preview: true })
}
