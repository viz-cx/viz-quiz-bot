import { Context } from 'telegraf'
import { Poll } from 'telegraf/typings/core/types/typegram'
import { QuizModel } from '@/models/Quiz'
import { findUser, User } from '@/models'

export function approveQuiz(ctx: Context, next: () => any) {
    const adminID = parseInt(process.env.ADMIN_TELEGRAM_ID)
    if (ctx.chat.id !== adminID) {
        return next()
    }
    let poll = (ctx.message as any).poll as Poll
    let author = (ctx.message as any).forward_from as User
    if (poll !== undefined && author !== undefined) {
        if (poll.type !== 'quiz') {
            ctx.reply(ctx.i18n.t('not_quiz'))
            return next()
        }
        let quiz = new QuizModel()
        quiz.question = poll.question
        let answers: string[] = []
        for (let i = 0; i < poll.options.length; i++) {
            let answer = poll.options[i].text
            if (i === poll.correct_option_id) {
                answers.unshift(answer)
            } else {
                answers.push(answer)
            }
        }
        quiz.answers = answers
        quiz.explanation = poll.explanation // TODO: explanation_entities
        quiz.authorId = author.id
        quiz.pollId = poll.id
        quiz.save()
            .then(quiz => {
                payToAuthor(quiz.authorId, ctx)
                ctx.reply(ctx.i18n.t('success_added'))
            })
            .catch(err => {
                if (err.message.includes('E11000')) {
                    ctx.reply(ctx.i18n.t('already_added'))
                } else {
                    ctx.reply(err.message)
                }
            })
    } else {
        return next()
    }
}

function payToAuthor(authorId: number, ctx: Context) {
    findUser(authorId)
        .then(author => {
            author.balance = author.balance + 100
            author.save()
                .then(author => {
                    let payload = { score: 100, balance: author.balance }
                    ctx.telegram.sendMessage(author.id, ctx.i18n.t('success_pay_for_quiz', payload))
                })
        })
}
