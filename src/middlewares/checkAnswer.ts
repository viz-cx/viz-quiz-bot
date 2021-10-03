import { Context } from 'telegraf'

export const nextQuestionKeyboard = {
    inline_keyboard: [[{ text: "Следующий квиз", callback_data: "next_quiz" }]]
}

export async function checkAnswer(ctx: Context, next: () => any) {
    let user = ctx.dbuser
    if (user.id === 146277382) {
        console.log('Commodore:', user, ctx)
    }
    if (ctx.poll) {
        if (user.id === 930884212) {
            console.log('VIZPlus:', user, ctx.poll)
        }
        if (ctx.poll.type !== 'quiz') {
            console.log('Poll is not quiz')
            return next()
        }
        if (ctx.poll.id !== user.pollId) {
            console.log(`Not current pool for ${user.id}`)
            user.quizMessageId = null
            user.pollId = null
            user.quizId = null
            user.save()
            return next()
        }
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
        if (!ctx.poll.is_closed) {
            if (allVotesCount === 1) {
                if (isCorrectAnswer) {
                    const baseValue = 100
                    const addValue = baseValue + (baseValue / 10 * user.multiplier)
                    user.balance = user.balance + addValue
                    user.multiplier = user.multiplier + 1
                    console.log(`Add ${addValue} to ${user.id} for right answer (now ${user.balance})`)
                    let payload = { score: addValue, balance: user.balance }
                    ctx.telegram.sendMessage(ctx.dbuser.id, ctx.i18n.t('success_pay_for_answer', payload))
                } else {
                    console.log(`Incorrect answer for user ${user.id}`)
                    user.multiplier = 0
                }
            } else {
                console.log(`Votes count = ${allVotesCount} for user ${user.id}`)
            }
        } else {
            console.log(`Poll is closed for user ${user.id}`)
        }
        user.answered.push(user.quizId)
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
