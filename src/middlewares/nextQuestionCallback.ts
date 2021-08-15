import { Context } from 'telegraf'
import { sendQuiz } from '@/handlers/sendQuiz'

export async function nextQuestionCallback(ctx: Context, next: () => any) {
    if (ctx.callbackQuery && (ctx.callbackQuery as any).data === 'next_quiz') {
        return sendQuiz(ctx)
    } else {
        return next()
    }
}
