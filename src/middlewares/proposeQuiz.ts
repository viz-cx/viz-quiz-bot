import { selectKeyboard } from '@/handlers/sendSelect'
import { addToBalance, findQuizByPollId, findUser, QuizModel, User } from '@/models'
import { Context } from 'telegraf'
import { Poll } from 'telegraf/typings/core/types/typegram'

export async function proposeQuiz(ctx: Context, next: () => any) {
    if (ctx.message === undefined) {
        return next()
    }

    let poll = (ctx.message as any).poll as Poll
    if (poll === undefined) {
        return next()
    }

    if (poll.type !== 'quiz') {
        await ctx.reply(ctx.i18n.t('not_quiz'))
        return next()
    }

    const quizByPollId = await findQuizByPollId(poll.id)
    if (quizByPollId) {
        return await ctx.reply(ctx.i18n.t('already_added'))
    }

    if (ctx.dbuser.selectedSection === undefined) {
        let keyboard = await selectKeyboard(ctx)
        return await ctx.reply(ctx.i18n.t('section_not_selected'), keyboard)
    }

    if (poll.type !== 'quiz') {
        return await ctx.reply(ctx.i18n.t('not_quiz'))
    }

    if (!poll.correct_option_id) {
        return await ctx.reply(ctx.i18n.t('something_wrong'))
    }

    let answers: string[] = []
    for (let i = 0; i < poll.options.length; i++) {
        let answer = poll.options[i].text
        if (i === poll.correct_option_id) {
            answers = [answer, ...answers] // correct answer first
        } else {
            answers = [...answers, answer]
        }
    }

    let quiz = new QuizModel()
    quiz.question = poll.question
    quiz.answers = answers
    quiz.explanation = poll.explanation // TODO: explanation_entities
    quiz.authorId = ctx.message.from.id
    quiz.pollId = poll.id
    quiz.sectionId = ctx.dbuser.selectedSection
    await quiz.save()
        .then(quiz => {
            // payToAuthor(quiz.authorId, ctx)
            ctx.reply(ctx.i18n.t('success_added'))
        })
        .catch(err => {
            if (err.message.includes('E11000')) {
                ctx.reply(ctx.i18n.t('already_added'))
            } else {
                console.log(err)
                ctx.reply(err.message)
            }
        })

    await sendToSupport(ctx)
}

function payToAuthor(authorId: number, ctx: Context) {
    let add = 500
    addToBalance(authorId, add)
        .then(_ => {
            findUser(authorId)
                .then(author => {
                    let payload = { score: add, balance: author.balance }
                    ctx.telegram.sendMessage(author.id, ctx.i18n.t('success_pay_for_quiz', payload))
                })
        })
}

async function sendToSupport(ctx: Context) {
    const techChatId = parseInt(process.env.ADMIN_TELEGRAM_ID)
    await ctx.forwardMessage(techChatId)
}
