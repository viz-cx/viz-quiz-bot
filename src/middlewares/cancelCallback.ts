import { sendMainKeyboard } from '@/helpers/keyboard'
import { Context } from 'telegraf'

export async function cancelCallback(ctx: Context, next: () => any) {
    if (ctx.callbackQuery && (ctx.callbackQuery as any).data === 'cancel') {
        ctx.dbuser.state = ''
        await ctx.dbuser.save()
        try {
            await ctx.deleteMessage(ctx.callbackQuery.message.message_id)
        } catch (_) { }
        return sendMainKeyboard(ctx)
    } else {
        return next()
    }
}
