import { findQuizById, findUnasweredQuizzes, Quiz } from "@/models/Quiz"
import { Context } from "telegraf"
import { nextQuestionKeyboard } from "@/middlewares/checkAnswer"

export async function sendQuiz(ctx: Context) {
    deletePreviousMessage(ctx)
    let answeredQuizzes = ctx.dbuser.answered
    if (answeredQuizzes === null) {
        answeredQuizzes = []
    }
    let unansweredQuizzes = await findUnasweredQuizzes(answeredQuizzes)
    if (unansweredQuizzes.length === 0) {
        let replyMsg = ctx.reply(ctx.i18n.t('no_unanswered_quizzes'), { reply_markup: nextQuestionKeyboard })
        replyMsg.then(msg => {
            let user = ctx.dbuser
            user.quizMessageId = msg.message_id
            user.quizId = null
            user.save()
        })
        return
    }
    let randomQuiz: Quiz
    if (ctx.dbuser.quizId !== null) {
        randomQuiz = await findQuizById(ctx.dbuser.quizId)
    }
    if (!randomQuiz) {
        randomQuiz = unansweredQuizzes[Math.floor(Math.random() * unansweredQuizzes.length)]
    }
    let question = randomQuiz.question
    let answers = randomQuiz.answers
    let correctValue = answers[0]
    let shuffledAnswers = shuffle(answers)
    let correctValueID = shuffledAnswers.indexOf(correctValue)
    let explanation = randomQuiz.explanation
    let secondsToAnswer = 30
    ctx.replyWithQuiz(question, shuffledAnswers, {
        is_anonymous: true,
        allows_multiple_answers: false,
        correct_option_id: correctValueID,
        is_closed: false,
        explanation: explanation,
        open_period: secondsToAnswer
    }).then(msg => {
        let user = ctx.dbuser
        user.pollId = msg.poll.id
        user.quizMessageId = msg.message_id
        user.quizId = randomQuiz._id
        user.save()
        setTimeout(function () {
            closePoll(ctx, msg.message_id)
        }, (secondsToAnswer - 1) * 1000)
    })
}

export async function deletePreviousMessage(ctx: Context) {
    let user = ctx.dbuser
    if (user.quizMessageId) {
        try {
            await ctx.deleteMessage(user.quizMessageId)
        } catch (_) { }
    }
}

function shuffle(array) {
    var currentIndex = array.length, temporaryValue, randomIndex
    while (0 !== currentIndex) {
        randomIndex = Math.floor(Math.random() * currentIndex)
        currentIndex -= 1
        temporaryValue = array[currentIndex]
        array[currentIndex] = array[randomIndex]
        array[randomIndex] = temporaryValue
    }
    return array
}

async function closePoll(ctx: Context, message_id: number) {
    try {
        await ctx.stopPoll(message_id)
    } catch (_) { }
}
