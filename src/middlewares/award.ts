// src/middlewares/award.ts
import { Difficulty, User } from '@/models'
import { addToBalance, findUser } from '@/models/User'
import { getInviterForTopic } from '@/models/TopicMembership'
import { Quiz } from '@/models/Quiz'
import { DocumentType } from '@typegoose/typegoose'
import { MyContext } from '@/types/context'

// Anti-grind caps. Correctness can never be proof-of-work against a client that
// holds the answer key, so bound how fast/how much any account can extract.
export const MAX_MULTIPLIER = 10
export const MIN_ANSWER_INTERVAL_MS = 3000
export const EARN_WINDOW_MS = 60 * 60 * 1000
export const EARN_WINDOW_CAP = 60

export interface AwardResult {
    rewarded: boolean
    suppressed: boolean   // rate-limited (too fast / over window cap)
    solverReward: number
}

/**
 * Apply reward + caps for a single-tap answer. Mutates ctx.dbuser in place;
 * pushes the quiz to `answered`. Does NOT save or clear quizId — caller does.
 * Sends author/inviter notifications in the background. The solver's own
 * feedback is the edited question message (rendered by the caller).
 */
export async function awardForAnswer(
    ctx: MyContext,
    quiz: DocumentType<Quiz>,
    correct: boolean
): Promise<AwardResult> {
    const user = ctx.dbuser
    const accuracy = correct ? 1 : 0

    if (!correct) {
        user.multiplier = 0
        user.answered.push(user.quizId)
        return { rewarded: false, suppressed: false, solverReward: 0 }
    }

    const now = new Date()

    // Normalize any legacy over-cap streak (balances untouched).
    if (user.multiplier > MAX_MULTIPLIER) {
        user.multiplier = MAX_MULTIPLIER
    }

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
        console.log(`Rate-limited reward for user ${user.id} (tooFast=${tooFast}, overCap=${overCap})`)
        user.multiplier = 0
        user.lastAnsweredAt = now
        user.earnWindowStart = windowStart
        user.earnWindowCount = windowCount + 1
        user.answered.push(user.quizId)
        return { rewarded: false, suppressed: true, solverReward: 0 }
    }

    const baseValue = 100
    let totalReward = baseValue + (baseValue / 10 * user.multiplier)
    switch ((user as User).difficulty) {
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

    let inviterId = 0
    let authorId: number | null = quiz.authorId ?? null
    if (quiz.sectionId) {
        inviterId = await getInviterForTopic(quiz.sectionId, user.id)
    }

    const hasInviter = inviterId > 0 && inviterId !== user.id
    let solverReward: number
    let authorReward: number
    let inviterReward: number
    if (hasInviter) {
        solverReward = totalReward * 0.40
        authorReward = totalReward * 0.40
        inviterReward = totalReward * 0.20
    } else {
        solverReward = totalReward * 0.60
        authorReward = totalReward * 0.40
        inviterReward = 0
    }

    user.balance = user.balance + solverReward
    user.multiplier = Math.min(user.multiplier + 1, MAX_MULTIPLIER)
    console.log(`Add ${solverReward} to solver ${user.id} (total reward ${totalReward}, now ${user.balance})`)

    if (authorId !== null && authorId !== user.id) {
        addToBalance(authorId, authorReward)
            .then(() => findUser(authorId!))
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
        user.balance = user.balance + authorReward
    }

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
    return { rewarded: true, suppressed: false, solverReward }
}
