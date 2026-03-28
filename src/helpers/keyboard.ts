import { Keyboard } from 'grammy'
import { MyContext } from '@/types/context'
import { t } from '@/helpers/i18n'

export enum Emoji {
    Quiz = '🧠',
    Select = '🔬',
    Difficulty = '⌛️',
    Withdrawal = '🏦',
    Cheque = '💰',
    Catalogue = '📚'
}

export function sendMainKeyboard(ctx: MyContext) {
    const link = 'https://t.me/' + ctx.me.username + '?start=' + ctx.dbuser.id
    const params = {
        botname: ctx.me.username,
        userID: ctx.dbuser.id,
        link: link
    }
    return ctx.reply(ctx.i18n.t('help', params), {
        parse_mode: 'HTML',
        reply_markup: mainKeyboard(ctx.i18n.locale()).reply_markup,
        link_preview_options: { is_disabled: true }
    })
}

export function mainKeyboard(language: string) {
    const quiz = Emoji.Quiz + ' ' + t(language, 'quiz_button')
    const select = Emoji.Select + ' ' + t(language, 'select_button')
    const difficulty = Emoji.Difficulty + ' ' + t(language, 'difficulty_button')
    const withdrawal = Emoji.Withdrawal + ' ' + t(language, 'results_button')
    const catalogue = Emoji.Catalogue + ' ' + t(language, 'catalogue_button')
    return {
        reply_markup: new Keyboard()
            .text(quiz).text(select).row()
            .text(difficulty).text(withdrawal).row()
            .text(catalogue)
            .resized()
    }
}
