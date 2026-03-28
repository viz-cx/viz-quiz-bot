import { MyContext } from '@/types/context'
import { NextFunction } from 'grammy'
import { sendQuiz } from '@/handlers/sendQuiz'

export async function nextQuestionCallback(ctx: MyContext, next: NextFunction) {
    if (ctx.callbackQuery && 'data' in ctx.callbackQuery && ctx.callbackQuery.data === 'next_quiz') {
        return sendQuiz(ctx)
    } else {
        return next()
    }
}
