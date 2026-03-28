import { MyContext } from "@/types/context";
import { InlineKeyboard } from "grammy";
import { NextFunction } from "grammy";

export async function sendReset(ctx: MyContext) {
    let weekAgo = new Date(Date.now() - 604800000)
    let user = ctx.dbuser
    if (user.resetedAt > weekAgo) {
        await ctx.reply('⛔️ ' + ctx.i18n.t('reset_unavailable'), { parse_mode: 'HTML' })
        return
    }
    const kb = new InlineKeyboard().text('💀 ' + ctx.i18n.t('reset_button'), 'reset')
    await ctx.reply('🤔 ' + ctx.i18n.t('reset'), { parse_mode: 'HTML', reply_markup: kb })
}

export async function resetCallback(ctx: MyContext, next: NextFunction) {
    if (ctx.callbackQuery && 'data' in ctx.callbackQuery && ctx.callbackQuery.data === 'reset') {
        let weekAgo = new Date(Date.now() - 604800000)
        let user = ctx.dbuser
        if (user.resetedAt > weekAgo) {
            return await ctx.editMessageText('⛔️ ' + ctx.i18n.t('reset_unavailable'))
        } else {
            user.balance = 0
            user.multiplier = 0
            user.answered = []
            user.resetedAt = new Date()
            await user.save()
            console.log('!!! Reset user', user.id)
            return await ctx.editMessageText('✅ ' + ctx.i18n.t('reset_success'))
        }
    } else {
        return next()
    }
}
