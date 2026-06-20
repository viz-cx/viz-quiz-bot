import { findQuizById, findUnasweredQuizzes, findUnansweredQuizzesInSection, Quiz } from "@/models/Quiz"
import { MyContext } from "@/types/context"
import { nextQuestionKeyboard } from "@/helpers/keyboard2"
import { Difficulty, findUser, User } from "@/models"
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

    // Inline-button path only supports single-correct quizzes.
    unansweredQuizzes = unansweredQuizzes.filter((q: any) =>
        Array.isArray(q.correctAnswerIndices) && q.correctAnswerIndices.length === 1
    )
    if (unansweredQuizzes.length === 0) {
        await ctx.reply(ctx.i18n.t('no_unanswered_quizzes'), { reply_markup: nextQuestionKeyboard })
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
    const buttons = answers.map((text: string, i: number) => [
        { text, callback_data: `ans:${randomQuiz._id.toString()}:${i}` }
    ])

    const botApi = ctx.api
    const timeUpText = ctx.i18n.t('time_up')

    ctx.reply(question, { reply_markup: { inline_keyboard: buttons } }).then(async (msg: any) => {
        let user = ctx.dbuser
        user.quizMessageId = msg.message_id
        user.quizId = randomQuiz._id
        user.quizExpiresAt = new Date(Date.now() + secondsToAnswer * 1000)
        await user.save()

        const expireTimer = setTimeout((userId: number, chatId: number, messageId: number, quizIdStr: string) => {
            findUser(userId)
                .then(u => {
                    if (u && u.quizId && u.quizId.toString() === quizIdStr) {
                        u.quizId = null
                        u.quizMessageId = null
                        u.quizExpiresAt = null
                        return u.save().then(() =>
                            botApi.editMessageText(chatId, messageId, timeUpText)
                                .catch(() => { }))
                    }
                })
                .catch(err => console.error(`Failed to expire quiz for user ${userId}`, err))
        }, secondsToAnswer * 1000, user.id, ctx.chat.id, msg.message_id, randomQuiz._id.toString())
        expireTimer.unref()
    }).catch((err: any) => console.error('Failed to send quiz message', err))
}

export async function deletePreviousMessage(ctx: MyContext) {
    let user = ctx.dbuser
    if (user.quizMessageId) {
        try {
            await ctx.api.deleteMessage(ctx.chat.id, user.quizMessageId)
        } catch (_) { }
    }
}

