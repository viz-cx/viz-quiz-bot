import { Context, Markup as m } from "telegraf";

export const difficultyEmojies = ['😐', '🤨', '🤯', '😱']
const buttonTexts = ['Низкая', 'Обычная', 'Высокая', 'Безумная']

export function sendDifficulty(ctx: Context) {
    return ctx.reply(ctx.i18n.t('difficulty'), difficultyKeyboard())
}

function difficultyKeyboard() {
    let result = []
    difficultyEmojies.forEach((emoji, index) => {
        const text = emoji + ' ' + buttonTexts[index]
        result.push([m.button.callback(text, emoji)])
    })
    return m.inlineKeyboard(result)
}

export async function setDifficulty(ctx: Context) {
    if ('data' in ctx.callbackQuery) {
        let user = ctx.dbuser
        let emoji = ctx.callbackQuery.data
        let difficulty = difficultyEmojies.indexOf(emoji)
        if (difficulty === -1) { return }
        let twoMinutesAgo = new Date(Date.now() - 1000 * 60 * 2)
        if (user.updatedAt > twoMinutesAgo) {
            ctx.telegram.answerCbQuery(ctx.callbackQuery.id, ctx.i18n.t('difficulty_time'))
            return 
        }
        user.difficulty = difficulty
        user = await (user as any).save()

        const message = ctx.callbackQuery.message

        await ctx.telegram.editMessageText(
            message.chat.id,
            message.message_id,
            undefined,
            ctx.i18n.t('difficulty_selected', {'difficulty': buttonTexts[difficulty]}),
            { parse_mode: 'HTML' }
        )
    }
}
