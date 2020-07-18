import { Context } from 'telegraf'

export async function checkAnswer(ctx: Context, next: () => any) {
    console.log(ctx)
    if (ctx.updateType === 'poll') {
        console.log(ctx.poll)
        let options = ctx.poll.options
        var answerID = -1
        for (let i = 0; i < options.length; i++) {
            if (options[i].voter_count === 1) {
                answerID = i
            }
        }
        let isCorrectAnswer = (answerID == ctx.poll.correct_option_id)
        console.log(isCorrectAnswer)
    } else {
        next()
    }
}
