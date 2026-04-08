import { sectionsKeyboard } from '@/handlers/sendSelect'
import { addToBalance, findQuizByPollId, findUser, QuizModel } from '@/models'
import { getSectionsByUser } from '@/models/Section'
import { MyContext } from '@/types/context'
import { NextFunction } from 'grammy'

export async function proposeQuiz(ctx: MyContext, next: NextFunction) {
    if (ctx.message === undefined) {
        return next()
    }

    let poll = (ctx.message as any).poll
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
        const sections = await getSectionsByUser(ctx.dbuser.id)
        let keyboard = sectionsKeyboard(sections, ctx)
        return await ctx.reply(ctx.i18n.t('section_not_selected'), keyboard)
    }

    let correctOptionIds: number[]
    if (Array.isArray(poll.correct_option_ids) && poll.correct_option_ids.length > 0) {
        correctOptionIds = poll.correct_option_ids
    } else if (typeof poll.correct_option_id === 'number') {
        correctOptionIds = [poll.correct_option_id]
    } else {
        // Correct answer data not available (e.g. forwarded from a non-private context)
        // Default to first answer as correct
        console.log('proposeQuiz: no correct answer data, defaulting to [0]. Poll:', JSON.stringify(poll))
        correctOptionIds = [0]
    }

    let answers: string[] = poll.options.map((o: any) => o.text)

    let quiz = new QuizModel()
    quiz.question = poll.question
    quiz.answers = answers
    quiz.correctAnswerIndices = correctOptionIds
    quiz.description = poll.description || undefined
    quiz.explanation = poll.explanation
    quiz.authorId = ctx.message.from.id
    quiz.pollId = poll.id
    quiz.sectionId = ctx.dbuser.selectedSection
    await quiz.save()
        .then(quiz => {
            payToAuthor(quiz.authorId, ctx)
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

function payToAuthor(authorId: number, ctx: MyContext) {
    let add = 500
    addToBalance(authorId, add)
        .then(_ => {
            findUser(authorId)
                .then(author => {
                    let payload = { score: add, balance: author.balance }
                    ctx.api.sendMessage(author.id, ctx.i18n.t('success_pay_for_quiz', payload))
                })
        })
}

async function sendToSupport(ctx: MyContext) {
    const techChatId = parseInt(process.env.ADMIN_TELEGRAM_ID)
    await ctx.forwardMessage(techChatId)
}
