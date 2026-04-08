import { findQuizById, findUnasweredQuizzes, findUnansweredQuizzesInSection, Quiz } from "@/models/Quiz"
import { MyContext } from "@/types/context"
import { nextQuestionKeyboard } from "@/middlewares/checkAnswer"
import { Difficulty, findUser, User } from "@/models"
import { DocumentType } from "@typegoose/typegoose/lib/types"
import { mongoose } from "@typegoose/typegoose"

const exitTopicKeyboard = {
    inline_keyboard: [
        [{ text: "Следующий квиз", callback_data: "next_quiz" }],
        [{ text: "🔙 Выйти из темы", callback_data: "exit_topic" }]
    ]
}

export async function sendQuiz(ctx: MyContext) {
    deletePreviousMessage(ctx)
    let answeredQuizzes = ctx.dbuser.answered
    if (answeredQuizzes === null) {
        answeredQuizzes = []
    }

    // Topic mode: pull quizzes from the active section only
    const activeTopic = ctx.dbuser.activeTopicSection
    let unansweredQuizzes: any

    if (activeTopic) {
        const sectionId = new mongoose.Types.ObjectId(activeTopic.toString())
        unansweredQuizzes = await findUnansweredQuizzesInSection(sectionId, answeredQuizzes)
        if (unansweredQuizzes.length === 0) {
            const replyMsg = ctx.reply(ctx.i18n.t('topic_exhausted'), { reply_markup: exitTopicKeyboard })
            replyMsg.then(msg => {
                let user = ctx.dbuser
                user.quizMessageId = msg.message_id
                user.quizId = null
                user.save()
            })
            return
        }
    } else {
        // Free-play mode: all sections
        unansweredQuizzes = await findUnasweredQuizzes(answeredQuizzes)
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
    let correctOptionIds = randomQuiz.correctAnswerIndices ?? [0]
    let explanation = randomQuiz.explanation
    let description = randomQuiz.description
    let secondsToAnswer: number
    switch ((ctx.dbuser as User).difficulty) {
        case Difficulty.Easy:
            secondsToAnswer = 600
            break
        case Difficulty.Hard:
            secondsToAnswer = 20
            break
        case Difficulty.Nightmare:
            secondsToAnswer = 10
            break
        default:
            secondsToAnswer = 60
            break
    }
    const pollOptions: any = {
        type: 'quiz',
        is_anonymous: true,
        allows_multiple_answers: correctOptionIds.length > 1,
        correct_option_ids: correctOptionIds,
        is_closed: false,
        explanation: explanation,
        open_period: secondsToAnswer,
        shuffle_options: true,
        hide_results_until_closes: true,
    }
    if (description) {
        pollOptions.description = description
    }
    ctx.replyWithPoll(question, answers, pollOptions).then(msg => {
        let user = ctx.dbuser
        user.pollId = msg.poll.id
        user.quizMessageId = msg.message_id
        user.quizId = randomQuiz._id
        user.save()
        setTimeout((userId, quizMessageId, messageId) => {
            findUser(userId)
                .then(u => {
                    let answeredQuizzes = u.answered
                    if (answeredQuizzes === null) {
                        answeredQuizzes = []
                    }
                    if (!answeredQuizzes.includes(quizMessageId)) {
                        closePoll(ctx, messageId)
                    }
                })
        }, (secondsToAnswer - 1) * 1000, user.id, user.quizId, msg.message_id)
    })
}

export async function deletePreviousMessage(ctx: MyContext) {
    let user = ctx.dbuser
    if (user.quizMessageId) {
        try {
            await ctx.api.deleteMessage(ctx.chat.id, user.quizMessageId)
        } catch (_) { }
    }
}

async function closePoll(ctx: MyContext, message_id: number) {
    try {
        await ctx.api.stopPoll(ctx.chat.id, message_id)
    } catch (_) { }
}
