import { bot } from './helpers/bot'
import { t } from './helpers/i18n'
import { UserModel } from './models/User'

export async function startDigests(): Promise<void> {
    const intervalMs = 15 * 60 * 1000
    setTimeout(() => {
        makeDigests().finally(() => startDigests())
    }, intervalMs)
}

export async function makeDigests(): Promise<void> {
    const now = new Date()
    let doc: any
    while ((doc = await UserModel.findOneAndUpdate(
        {
            digestDueAt: { $lte: now },
            $or: [
                { pendingAuthorIncome: { $gt: 0 } },
                { pendingInviterIncome: { $gt: 0 } }
            ]
        },
        { $set: { pendingAuthorIncome: 0, pendingInviterIncome: 0, digestDueAt: null } },
        { new: false }
    ).lean().exec()) != null) {
        const authorIncome: number = doc.pendingAuthorIncome ?? 0
        const inviterIncome: number = doc.pendingInviterIncome ?? 0
        const balance: number = doc.balance ?? 0
        const language: string = doc.language ?? 'ru'
        const userId: number = doc.id

        const lines: string[] = []
        if (authorIncome > 0) {
            lines.push(t(language, 'digest_author_income', { score: Math.round(authorIncome) }))
        }
        if (inviterIncome > 0) {
            lines.push(t(language, 'digest_inviter_income', { score: Math.round(inviterIncome) }))
        }
        lines.push(t(language, 'digest_balance', { balance: Math.round(balance) }))

        await bot.api.sendMessage(userId, lines.join('\n'))
            .catch(err => console.error(`Failed to send digest to user ${userId}:`, err))
    }
}
