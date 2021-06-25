import { Context } from 'telegraf'

export const nextQuestionKeyboard = {
    inline_keyboard: [[{ text: "Следующий вопрос", callback_data: "next_question" }]]
}

export async function checkAnswer(ctx: Context, next: () => any) {
    if (ctx.updateType === 'poll') {
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
        let isCorrectAnswer = (answerID == ctx.poll.correct_option_id)
        if (!ctx.poll.is_closed && allVotesCount == 1 && isCorrectAnswer) {
            console.log('TODO: add tokens')
        }
        let user = ctx.dbuser
        user.answeredQuizIds.push(user.quizId)
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
