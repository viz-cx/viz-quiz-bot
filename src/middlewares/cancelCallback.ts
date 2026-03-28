import { questionsKeyboard, sectionsKeyboard } from '@/handlers/sendSelect'
import { sendMainKeyboard } from '@/helpers/keyboard'
import { findQuizzesBySection } from '@/models'
import { findSection, getSectionsByUser } from '@/models/Section'
import { MyContext } from '@/types/context'
import { NextFunction } from 'grammy'

export enum CancelCallback {
    cancel = "cancel",
    cancel_section = "cancel_section",
    cancel_question = "cancel_question",
}

export async function cancelCallback(ctx: MyContext, next: NextFunction) {
    let data: CancelCallback
    if (ctx.callbackQuery && 'data' in ctx.callbackQuery) {
        let str = ctx.callbackQuery.data
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
        await ctx.deleteMessage()
    } catch (_) { }

    switch (data) {
    case 'cancel_section':
        const sections = await getSectionsByUser(ctx.dbuser.id)
        let k = sectionsKeyboard(sections, ctx)
        return await ctx.reply(ctx.i18n.t('select'), k)
    case 'cancel_question':
        let section = await findSection(ctx.dbuser.selectedSection as any)
        let quizzes = await findQuizzesBySection(ctx.dbuser.selectedSection as any)
        let kb = questionsKeyboard(quizzes, section, ctx)
        return await ctx.reply(ctx.i18n.t('section', { section: section.title }), { parse_mode: "MarkdownV2", reply_markup: kb.reply_markup })
    default:
        return await sendMainKeyboard(ctx)
    }
}
