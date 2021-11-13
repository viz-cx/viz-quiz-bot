import { Markup as m } from 'telegraf';
import { Context } from "telegraf/typings/context";

export async function sendReset(ctx: Context) {
    let weekAgo = new Date(Date.now() - 604800000)
    let user = ctx.dbuser
    if (user.resetedAt > weekAgo) {
        await ctx.replyWithHTML('⛔️ ' + ctx.i18n.t('reset_unavailable'))
        return
    }
    await ctx.replyWithHTML('🤔 ' + ctx.i18n.t('reset'), m.inlineKeyboard([m.button.callback('💀 ' + ctx.i18n.t('reset_button'), 'reset')]))
}

export async function resetCallback(ctx: Context, next: () => any) {
    if (ctx.callbackQuery && (ctx.callbackQuery as any).data === 'reset') {
        let weekAgo = new Date(Date.now() - 604800000)
        let user = ctx.dbuser
        if (user.resetedAt > weekAgo) {
            return await ctx.editMessageText('⛔️ ' + ctx.i18n.t('reset_unavailable'))
        } else {
            user.balance = 0
            user.multiplier = 0
            user.resetedAt = new Date()
            await user.save()
            console.log('!!! Reset user', user.id)
            return await ctx.editMessageText('✅ ' + ctx.i18n.t('reset_success'))
        }
    } else {
        return next()
    }
}
