import { Context, Markup as m } from "telegraf"
import { i18n } from "@/helpers/i18n"

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
    const play = m.button.callback('🧠 ' + i18n.t(language, 'quiz_button'), 'play')
    const withdrawal = m.button.callback('🏦 ' + i18n.t(language, 'results_button'), 'results')
    const difficulty = m.button.callback('⌛️ ' + i18n.t(language, 'difficulty_button'), 'difficulty')
    const info = m.button.callback('ℹ️ ' + i18n.t(language, 'info_button'), 'info')
    return m.keyboard([
        [play, withdrawal],
        // [difficulty, info]
        [info]
    ]).resize()
}
