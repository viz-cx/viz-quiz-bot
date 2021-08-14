import { Context } from "telegraf";

export async function sendResults(ctx: Context) {
    ctx.reply(ctx.i18n.t('results'))
}
