import { User, UserModel } from '@/models/User'
import { DocumentType } from '@typegoose/typegoose'
import { Context } from 'telegraf'

export const nextQuestionKeyboard = {
    inline_keyboard: [[{ text: "Следующий квиз", callback_data: "next_quiz" }]]
}

export async function checkAnswer(ctx: Context, next: () => any) {
    if (ctx.updateType === 'poll') {
        let user = ctx.dbuser
        if (ctx.poll.type !== 'quiz') { console.log('Poll is not quiz'); return }
        if (ctx.poll.id !== user.pollId) { console.log(`Not current pool for ${user.id}`); return }
        let options = ctx.poll.options
        var answerID = -1
        var allVotesCount = 0
        for (let i = 0; i < options.length; i++) {
            let voterCount = options[i].voter_count
            allVotesCount += voterCount
            if (voterCount == 1) {
                answerID = i
            }
        }
        let isCorrectAnswer = (answerID === ctx.poll.correct_option_id)
        if (!ctx.poll.is_closed && allVotesCount == 1 && isCorrectAnswer) {
            const baseValue = 100
            const addValue = baseValue + (baseValue / 10 * user.multiplier)
            user.balance = user.balance + addValue
            user.multiplier = user.multiplier + 1
            console.log(`Add ${addValue} to ${user.id} for right answer (now ${user.balance})`)
            let payload = { score: addValue, balance: user.balance }
            ctx.telegram.sendMessage(ctx.dbuser.id, ctx.i18n.t('success_pay_for_answer', payload))
        } else {
            user.multiplier = 0
        }
        user.answeredQuizzes.push(user.quizId)
        user.quizId = null
        user.save()
        setTimeout(() => addNextQuestionButton(ctx), 2000)
    } else {
        return next()
    }
}

function addNextQuestionButton(ctx: Context) {
    ctx.telegram.editMessageReplyMarkup(ctx.dbuser.id, ctx.dbuser.quizMessageId, undefined, nextQuestionKeyboard)
        .catch(err => console.log(err.message))
}
