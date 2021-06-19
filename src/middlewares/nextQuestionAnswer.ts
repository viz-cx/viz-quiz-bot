import { Context } from 'telegraf'
import { sendQuiz } from '@/handlers/sendQuiz'

export async function nextQuestionAnswer(ctx: Context, next: () => any) {
    if (ctx.callbackQuery && (ctx.callbackQuery as any).data === 'next_question') {
        return sendQuiz(ctx)
    } else {
        return next()
    }
}
