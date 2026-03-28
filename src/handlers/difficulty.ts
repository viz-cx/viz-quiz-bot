import { MyContext } from "@/types/context";
import { InlineKeyboard } from "grammy";

export const difficultyEmojies = ['😐', '🤨', '🤯', '😱']
const buttonTexts = ['Низкая', 'Обычная', 'Высокая', 'Безумная']

export function sendDifficulty(ctx: MyContext) {
    return ctx.reply(ctx.i18n.t('difficulty'), { reply_markup: difficultyKeyboard() })
}

function difficultyKeyboard() {
    const kb = new InlineKeyboard()
    difficultyEmojies.forEach((emoji, index) => {
        const text = emoji + ' ' + buttonTexts[index]
        kb.text(text, emoji).row()
    })
    return kb
}

export async function setDifficulty(ctx: MyContext) {
    if (ctx.callbackQuery && 'data' in ctx.callbackQuery) {
        let user = ctx.dbuser
        let emoji = ctx.callbackQuery.data
        let difficulty = difficultyEmojies.indexOf(emoji)
        if (difficulty === -1) { return }
        let twoMinutesAgo = new Date(Date.now() - 1000 * 60 * 2)
        if (user.updatedAt > twoMinutesAgo) {
            await ctx.answerCallbackQuery({ text: ctx.i18n.t('difficulty_time') })
            return
        }
        user.difficulty = difficulty
        user = await (user as any).save()

        await ctx.editMessageText(
            ctx.i18n.t('difficulty_selected', {'difficulty': buttonTexts[difficulty]}),
            { parse_mode: 'HTML' }
        )
    }
}
