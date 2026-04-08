import { Difficulty, User } from '@/models'
import { addToBalance, findUser } from '@/models/User'
import { findQuizById } from '@/models/Quiz'
import { getInviterForTopic } from '@/models/TopicMembership'
import { MyContext } from '@/types/context'
import { NextFunction } from 'grammy'

export const nextQuestionKeyboard = {
    inline_keyboard: [[{ text: "Следующий квиз", callback_data: "next_quiz" }]]
}

export function computeAccuracy(
    pickedIndices: number[],
    correctIndices: number[],
    totalOptions: number
): number {
    const totalCorrect = correctIndices.length
    const totalWrong = totalOptions - totalCorrect

    let correctPicked = 0
    let wrongPicked = 0
    for (const idx of pickedIndices) {
        if (correctIndices.includes(idx)) {
            correctPicked++
        } else {
            wrongPicked++
        }
    }

    const accuracy = (correctPicked / totalCorrect) - (totalWrong > 0 ? wrongPicked / totalWrong : 0)
    return Math.max(0, accuracy)
}

export async function checkAnswer(ctx: MyContext, next: NextFunction) {
    if (ctx.poll) {
        let user = ctx.dbuser
        let answeredQuizzes = user.answered
        if (answeredQuizzes === null) {
            answeredQuizzes = []
        }
        if (answeredQuizzes.includes(user.quizId)) {
            return next()
        }
        if (ctx.poll.type !== 'quiz') {
            console.log('Poll is not quiz')
            return next()
        }
        if (ctx.poll.id !== user.pollId) {
            console.log(`Not current pool for ${user.id}`)
            user.quizMessageId = null
            user.pollId = null
            user.quizId = null
            user.save()
            return next()
        }

        let options = ctx.poll.options
        const pickedIndices: number[] = []
        let allVotesCount = 0
        for (let i = 0; i < options.length; i++) {
            let voterCount = options[i].voter_count
            allVotesCount += voterCount
            if (voterCount === 1) {
                pickedIndices.push(i)
            }
        }

        const correctIndices: number[] = (ctx.poll as any).correct_option_ids
            ?? ((ctx.poll as any).correct_option_id != null ? [(ctx.poll as any).correct_option_id] : [])

        const accuracy = computeAccuracy(pickedIndices, correctIndices, options.length)

        if (pickedIndices.length > 0 && accuracy > 0) {
            const baseValue = 100
            let totalReward = baseValue + (baseValue / 10 * user.multiplier)
            switch ((ctx.dbuser as User).difficulty) {
                case Difficulty.Easy:
                    totalReward = totalReward * 0.5
                    break
                case Difficulty.Hard:
                    totalReward = totalReward * 1.5
                    break
                case Difficulty.Nightmare:
                    totalReward = totalReward * 2
                    break
                default:
                    totalReward = totalReward * 1
                    break
            }

            totalReward = totalReward * accuracy

            // Determine inviter for this quiz's section
            let inviterId = 0
            let authorId: number | null = null
            if (user.quizId) {
                const quiz = await findQuizById(user.quizId.toString())
                if (quiz) {
                    authorId = quiz.authorId
                    if (quiz.sectionId) {
                        inviterId = await getInviterForTopic(quiz.sectionId, user.id)
                    }
                }
            }

            // Distribute rewards
            const hasInviter = inviterId > 0 && inviterId !== user.id

            let solverReward: number
            let authorReward: number
            let inviterReward: number

            if (hasInviter) {
                // Topic invite mode: 40% solver, 40% author, 20% inviter
                solverReward = totalReward * 0.40
                authorReward = totalReward * 0.40
                inviterReward = totalReward * 0.20
            } else {
                // Free-play or no inviter: 60% solver, 40% author
                solverReward = totalReward * 0.60
                authorReward = totalReward * 0.40
                inviterReward = 0
            }

            // Pay solver
            user.balance = user.balance + solverReward
            if (accuracy === 1.0) {
                user.multiplier = user.multiplier + 1
            } else {
                user.multiplier = 0
            }
            console.log(`Add ${solverReward} to solver ${user.id} (accuracy ${accuracy}, total reward ${totalReward}, now ${user.balance})`)
            ctx.api.sendMessage(user.id, ctx.i18n.t('success_pay_for_answer', { score: Math.round(solverReward), balance: Math.round(user.balance) }))

            // Pay author (background, if different from solver)
            if (authorId !== null && authorId !== user.id) {
                addToBalance(authorId, authorReward).then(() => {
                    findUser(authorId).then(author => {
                        if (author) {
                            ctx.api.sendMessage(author.id, ctx.i18n.t('success_pay_for_quiz_answer', {
                                score: Math.round(authorReward),
                                balance: Math.round(author.balance)
                            }))
                        }
                    })
                })
            } else if (authorId === user.id) {
                // Solver is also the author — add both portions to the same user
                user.balance = user.balance + authorReward
                console.log(`Solver is also author — added ${authorReward} more (now ${user.balance})`)
            }

            // Pay inviter (background, if present and different from solver)
            if (hasInviter) {
                addToBalance(inviterId, inviterReward).then(() => {
                    findUser(inviterId).then(inviter => {
                        if (inviter) {
                            ctx.api.sendMessage(inviter.id, ctx.i18n.t('success_pay_as_inviter', {
                                score: Math.round(inviterReward),
                                balance: Math.round(inviter.balance)
                            }))
                        }
                    })
                })
            }

            user.answered.push(user.quizId)
        } else {
            console.log(`Incorrect answer for user ${user.id}`)
            user.multiplier = 0
        }
        user.quizId = null
        user.save()
    } else {
        return next()
    }
}
