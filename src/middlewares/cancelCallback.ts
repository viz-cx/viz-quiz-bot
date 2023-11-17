import { questionsKeyboard, sectionsKeyboard } from '@/handlers/sendSelect'
import { sendMainKeyboard } from '@/helpers/keyboard'
import { findQuizzesBySection } from '@/models'
import { findSection, getSectionsByUser } from '@/models/Section'
import { Context } from 'telegraf'

export enum CancelCallback {
    cancel = "cancel",
    cancel_section = "cancel_section",
    cancel_question = "cancel_question",
}

export async function cancelCallback(ctx: Context, next: () => any) {
    let data: CancelCallback
    if (ctx.callbackQuery && (ctx.callbackQuery as any).data) {
        let str = (ctx.callbackQuery as any).data
        const cancelCallbacks = Object.keys(CancelCallback)
        if (cancelCallbacks.includes(str)) {
            data = CancelCallback[str]
        } else {
            return next()
        }
    } else {
        return next()
    }
    ctx.dbuser.state = ''
    await ctx.dbuser.save()

    try {
        await ctx.deleteMessage(ctx.callbackQuery.message.message_id)
    } catch (_) { }

    switch (data) {
    case 'cancel_section':
        const sections = await getSectionsByUser(ctx.dbuser.id)
        let k = sectionsKeyboard(sections, ctx)
        return await ctx.sendMessage(ctx.i18n.t('select'), k)
    case 'cancel_question':
        let section = await findSection(ctx.dbuser.selectedSection)
        let quizzes = await findQuizzesBySection(ctx.dbuser.selectedSection)
        let kb = questionsKeyboard(quizzes, ctx)
        return await ctx.sendMessage(ctx.i18n.t('section', { section: section.title }), { parse_mode: "MarkdownV2", reply_markup: kb.reply_markup })
    default:
        return await sendMainKeyboard(ctx)
    }
}
