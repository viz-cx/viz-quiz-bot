import { Context, Markup as m } from "telegraf"
import { i18n } from "@/helpers/i18n"
import { InlineKeyboardButton } from "telegraf/typings/core/types/typegram"

export enum Emoji {
    Quiz = '🧠',
    Select = '🔬',
    Difficulty = '⌛️',
    Withdrawal = '🏦',
    Cheque = '💰'
}

export function sendMainKeyboard(ctx: Context) {
    const link = 'https://t.me/' + ctx.botInfo.username + '?start=' + ctx.dbuser.id
    const params = {
        botname: ctx.botInfo.username,
        userID: ctx.dbuser.id,
        link: link
    }
    return ctx.replyWithHTML(ctx.i18n.t('help', params), {
        reply_markup: mainKeyboard(ctx.i18n.locale()).reply_markup,
        disable_web_page_preview: true
    })
}

export function mainKeyboard(language: string) {
    const quiz = buttonByEmoji(Emoji.Quiz, language)
    const select = buttonByEmoji(Emoji.Select, language)
    const difficulty = buttonByEmoji(Emoji.Difficulty, language)
    const withdrawal = buttonByEmoji(Emoji.Withdrawal, language)
    return m.keyboard([
        [quiz, select],
        [difficulty, withdrawal]
    ]).resize()
}

function buttonByEmoji(emoji: Emoji, language: string): InlineKeyboardButton.CallbackButton {
    switch (emoji) {
        case Emoji.Quiz:
            return m.button.callback(emoji + ' ' + i18n.t(language, 'quiz_button'), '')
        case Emoji.Select:
            return m.button.callback(emoji + ' ' + i18n.t(language, 'select_button'), '')
        case Emoji.Difficulty:
            return m.button.callback(emoji + ' ' + i18n.t(language, 'difficulty_button'), '')
        case Emoji.Withdrawal:
            return m.button.callback(emoji + ' ' + i18n.t(language, 'results_button'), '')
    }
}
