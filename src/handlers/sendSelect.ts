import { Context } from "telegraf";
import { Markup as m } from 'telegraf';
import { Message } from "telegraf/typings/core/types/typegram";

export async function sendSelect(ctx: Context) {
    const keyboard = m.inlineKeyboard([
        m.button.callback('🔧 ' + ctx.i18n.t('create_button'), 'create_button')
    ])
    await ctx.replyWithHTML('👉️ ' + ctx.i18n.t('select'), keyboard)
}

export async function createCallback(ctx: Context, next: () => any) {
    if (ctx.callbackQuery && (ctx.callbackQuery as any).data === 'create_button') {
        ctx.dbuser.state = 'wait_title'
        await ctx.dbuser.save()
        let keyboard = m.inlineKeyboard([m.button.callback(ctx.i18n.t('cancel_button'), 'cancel')])
        return await ctx.editMessageText(ctx.i18n.t('create_enter_title'), keyboard)
    } else {
        return next()
    }
}

export async function checkTitleCallback(ctx: Context, next: () => any) {
    if (ctx.dbuser.state === 'wait_title' && ctx.message) {
        let text = (ctx.message as Message.TextMessage).text
        if (text === undefined || text.length === 0) {
            return ctx.reply(ctx.i18n.t('something_wrong'))
        }
        // Save new section
    } else {
        return next()
    }
}
