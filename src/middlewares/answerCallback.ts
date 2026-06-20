// src/middlewares/answerCallback.ts
import { MyContext } from '@/types/context'
import { NextFunction } from 'grammy'
import { findQuizById } from '@/models/Quiz'
import { awardForAnswer } from '@/middlewares/award'
import { nextQuestionKeyboard } from '@/helpers/keyboard2'

export async function answerCallback(ctx: MyContext, next: NextFunction) {
    const cq = ctx.callbackQuery
    if (!cq || !('data' in cq) || typeof cq.data !== 'string' || !cq.data.startsWith('ans:')) {
        return next()
    }

    const parts = cq.data.split(':')
    const quizIdStr = parts[1]
    const optionIndex = parseInt(parts[2], 10)
    const user = ctx.dbuser

    // Idempotency / validity: must be the user's currently-served question.
    if (!user.quizId || user.quizId.toString() !== quizIdStr || Number.isNaN(optionIndex)) {
        await ctx.answerCallbackQuery().catch(() => { })
        return
    }

    const quiz = await findQuizById(user.quizId)
    if (!quiz || optionIndex < 0 || optionIndex >= quiz.answers.length) {
        await ctx.answerCallbackQuery().catch(() => { })
        return
    }

    // Authoritative expiry check (survives restarts; timer is UX-only).
    if (user.quizExpiresAt && new Date() > user.quizExpiresAt) {
        user.quizId = null
        user.quizMessageId = null
        user.quizExpiresAt = null
        await user.save()
        await ctx.editMessageText(ctx.i18n.t('time_up')).catch(() => { })
        await ctx.answerCallbackQuery().catch(() => { })
        return
    }

    const correct = quiz.correctAnswerIndices.includes(optionIndex)
    const result = await awardForAnswer(ctx, quiz, correct)

    // Clear pending state (idempotency) before rendering.
    user.quizId = null
    user.quizMessageId = null
    user.quizExpiresAt = null
    await user.save()

    let body: string
    if (result.suppressed) {
        // Do not reveal correctness when rate-limited.
        body = ctx.i18n.t('answer_rate_limited')
    } else if (correct) {
        body = ctx.i18n.t('answer_correct', {
            score: Math.round(result.solverReward),
            balance: Math.round(user.balance),
        })
        if (quiz.explanation) body = `${body}\n\n${quiz.explanation}`
    } else {
        body = ctx.i18n.t('answer_incorrect')
        if (quiz.explanation) body = `${body}\n\n${quiz.explanation}`
    }

    await ctx.editMessageText(body, { reply_markup: nextQuestionKeyboard }).catch(() => { })
    await ctx.answerCallbackQuery().catch(() => { })
}
