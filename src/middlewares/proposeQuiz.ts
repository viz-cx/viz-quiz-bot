import { findQuizByPollId } from '@/models'
import { Context } from 'telegraf'
import { Poll } from 'telegraf/typings/core/types/typegram'

export async function proposeQuiz(ctx: Context, next: () => any) {
    // const adminID = parseInt(process.env.ADMIN_TELEGRAM_ID)
    // if (ctx.chat.id === adminID) { // ignore messages from admin
    //     return next()
    // }
    if (ctx.message === undefined) {
        return next()
    }
    let poll = (ctx.message as any).poll as Poll
    if (poll !== undefined) {
        if (poll.type !== 'quiz') {
            ctx.reply(ctx.i18n.t('not_quiz'))
            return next()
        }
        const quiz = await findQuizByPollId(poll.id)
        if (!quiz) {
            const techChatId = parseInt(process.env.ADMIN_TELEGRAM_ID)
            ctx.forwardMessage(techChatId)
                .then(_ => ctx.reply(ctx.i18n.t('to_moderation')))
        } else {
            ctx.reply(ctx.i18n.t('already_added'))
        }
    } else {
        return next()
    }
}
