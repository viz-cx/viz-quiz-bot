import { Difficulty, User } from '@/models'
import { addToBalance, findUser } from '@/models/User'
import { findQuizById } from '@/models/Quiz'
import { getInviterForTopic } from '@/models/TopicMembership'
import { MyContext } from '@/types/context'
import { NextFunction } from 'grammy'

export const nextQuestionKeyboard = {
    inline_keyboard: [[{ text: "Следующий квиз", callback_data: "next_quiz" }]]
}

// Anti-grind limits. Telegram quiz polls deliver the correct option to the
// client, so a scripted client can always answer correctly — "is the answer
// right" can never be trusted as proof-of-work. These caps bound how fast and
// how much any single account can extract, regardless of correctness.
//
// MAX_MULTIPLIER caps the streak bonus so a full quiz-bank clear can't balloon
// a balance (an uncapped streak previously reached ~6,380 points/answer).
// MIN_ANSWER_INTERVAL_MS rejects burst answering faster than a human could read.
// EARN_WINDOW_CAP bounds rewarded answers per EARN_WINDOW_MS window.
export const MAX_MULTIPLIER = 10
export const MIN_ANSWER_INTERVAL_MS = 3000
export const EARN_WINDOW_MS = 60 * 60 * 1000
export const EARN_WINDOW_CAP = 60

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
            await user.save()
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
            const now = new Date()

            // Normalize any legacy over-cap streak so existing inflated
            // multipliers can't keep paying out at the old uncapped rate.
            // (Balances are intentionally left untouched.)
            if (user.multiplier > MAX_MULTIPLIER) {
                user.multiplier = MAX_MULTIPLIER
            }

            // Anti-grind gates: reject answers that arrive faster than a human
            // could read, or beyond the per-window cap.
            const tooFast = user.lastAnsweredAt != null &&
                now.getTime() - user.lastAnsweredAt.getTime() < MIN_ANSWER_INTERVAL_MS
            let windowStart = user.earnWindowStart
            let windowCount = user.earnWindowCount ?? 0
            if (windowStart == null || now.getTime() - windowStart.getTime() >= EARN_WINDOW_MS) {
                windowStart = now
                windowCount = 0
            }
            const overCap = windowCount >= EARN_WINDOW_CAP

            if (tooFast || overCap) {
                // Consume the quiz so it isn't re-served, but pay nothing and
                // notify no one (this is what stops the reward-notification
                // spam from a grinder). Break the streak to discourage bursts.
                console.log(`Rate-limited reward for user ${user.id} (tooFast=${tooFast}, overCap=${overCap})`)
                user.multiplier = 0
                user.lastAnsweredAt = now
                user.earnWindowStart = windowStart
                user.earnWindowCount = windowCount
                user.answered.push(user.quizId)
            } else {
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
                    user.multiplier = Math.min(user.multiplier + 1, MAX_MULTIPLIER)
                } else {
                    user.multiplier = 0
                }
                console.log(`Add ${solverReward} to solver ${user.id} (accuracy ${accuracy}, total reward ${totalReward}, now ${user.balance})`)
                ctx.api.sendMessage(user.id, ctx.i18n.t('success_pay_for_answer', { score: Math.round(solverReward), balance: Math.round(user.balance) }))
                    .catch(err => console.error(`Failed to notify solver ${user.id}`, err))

                // Pay author (background, if different from solver)
                if (authorId !== null && authorId !== user.id) {
                    addToBalance(authorId, authorReward)
                        .then(() => findUser(authorId))
                        .then(author => {
                            if (author) {
                                return ctx.api.sendMessage(author.id, ctx.i18n.t('success_pay_for_quiz_answer', {
                                    score: Math.round(authorReward),
                                    balance: Math.round(author.balance)
                                }))
                            }
                        })
                        .catch(err => console.error(`Failed to pay/notify author ${authorId}`, err))
                } else if (authorId === user.id) {
                    // Solver is also the author — add both portions to the same user
                    user.balance = user.balance + authorReward
                    console.log(`Solver is also author — added ${authorReward} more (now ${user.balance})`)
                }

                // Pay inviter (background, if present and different from solver)
                if (hasInviter) {
                    addToBalance(inviterId, inviterReward)
                        .then(() => findUser(inviterId))
                        .then(inviter => {
                            if (inviter) {
                                return ctx.api.sendMessage(inviter.id, ctx.i18n.t('success_pay_as_inviter', {
                                    score: Math.round(inviterReward),
                                    balance: Math.round(inviter.balance)
                                }))
                            }
                        })
                        .catch(err => console.error(`Failed to pay/notify inviter ${inviterId}`, err))
                }

                user.answered.push(user.quizId)
                user.lastAnsweredAt = now
                user.earnWindowStart = windowStart
                user.earnWindowCount = windowCount + 1
            }
        } else {
            console.log(`Incorrect answer for user ${user.id}`)
            user.multiplier = 0
        }
        // Clear quizId and pollId so redelivered/duplicate poll updates (votes,
        // poll-close events, post-restart backlog) can't re-trigger payouts.
        // With pollId nulled, findUserByPollId won't re-match this poll.
        user.quizId = null
        user.pollId = null
        await user.save()
    } else {
        return next()
    }
}
