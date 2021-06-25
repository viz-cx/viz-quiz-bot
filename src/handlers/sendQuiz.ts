import { findUnasweredQuizzes } from "@/models/Quiz"
import { Context } from "telegraf"
import { nextQuestionKeyboard } from "@/middlewares/checkAnswer"

export async function sendQuiz(ctx: Context) {
    deletePreviousMessage(ctx)
    let answeredQuizIds = ctx.dbuser.answeredQuizIds
    if (answeredQuizIds === null) {
        answeredQuizIds = []
    }
    let unansweredQuizzes = await findUnasweredQuizzes(answeredQuizIds)
    if (unansweredQuizzes.length === 0) {
        let replyMsg = ctx.reply("Закончились неотвеченные вопросы, попробуйте завтра", { reply_markup: nextQuestionKeyboard })
        replyMsg.then(msg => {
            let user = ctx.dbuser
            user.quizMessageId = msg.message_id
            user.quizId = null
            user.save()
        })
        return
    }
    let randomQuiz = unansweredQuizzes[Math.floor(Math.random() * unansweredQuizzes.length)]
    let question = randomQuiz.question
    let answers = randomQuiz.answers
    let correctValue = answers[0]
    let shuffledAnswers = shuffle(answers)
    let correctValueID = shuffledAnswers.indexOf(correctValue)
    let explanation = randomQuiz.explanation
    // let secondsToAnswer = 10
    let quizMsg = ctx.replyWithQuiz(question, shuffledAnswers, {
        is_anonymous: true,
        allows_multiple_answers: false,
        correct_option_id: correctValueID,
        is_closed: false,
        explanation: explanation,
        // open_period: secondsToAnswer
    })
    quizMsg.then(msg => {
        let user = ctx.dbuser
        user.pollId = msg.poll.id
        user.quizMessageId = msg.message_id
        user.quizId = randomQuiz._id
        user.save()
        // setTimeout(function () { closePoll(ctx, msg.message_id) }, secondsToAnswer * 1000);
    })
}

export function deletePreviousMessage(ctx: Context) {
    let user = ctx.dbuser
    if (user.quizMessageId) {
        try {
            ctx.deleteMessage(user.quizMessageId)
                .catch(err => console.log("Message not deleted:", err))
        } catch (err) {
            console.log("Message not deleted:", err)
        }
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