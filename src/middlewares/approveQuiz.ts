import { Context } from 'telegraf'
import { Poll, User } from 'telegraf/typings/core/types/typegram'
import { QuizModel } from '@/models/Quiz'

export function approveQuiz(ctx: Context, next: () => any) {
    const adminID = 38968897
    if (ctx.chat.id !== adminID) {
        return next()
    }
    let poll = (ctx.message as any).poll as Poll
    let author = (ctx.message as any).forward_from as User
    if (poll !== undefined && author !== undefined) {
        if (poll.type !== 'quiz') {
            return
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
                console.log('TODO: Pay to author')
                ctx.reply('Quiz successfully added')
            })
            .catch(err => {
                if (err.message.includes('E11000')) {
                    ctx.reply('Quiz already added')
                } else {
                    ctx.reply(err.message)
                }
            })
    } else {
        return next()
    }
}
