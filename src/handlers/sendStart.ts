import { findUser } from "../models"
import { Context, Markup as m } from "telegraf"
import { i18n } from "../helpers/i18n"

export function sendStart(ctx: Context) {
    const payload: string = (ctx as any)['startPayload']
    const referrer = parseInt(payload)
    var user = ctx.dbuser
    if (!user.referrer && !isNaN(referrer)) {
        findUser(referrer)
            .then(
                result => {
                    if (result) {
                        console.log("referrrer", referrer)
                        user.referrer = referrer
                        user.save().then(_ => console.log('TODO: Pay to referrer'))
                    } else {
                        console.log('Referrer', referrer, 'doesn\'t exists')
                    }
                },
                err => console.log('Referrer error', referrer, err)
            )
    }
    return sendMainKeyboard(ctx)
}

export function sendMainKeyboard(ctx: Context) {
    var params = {
        botname: ctx.botInfo.username,
        userID: ctx.dbuser.id
    }
    return ctx.replyWithHTML(ctx.i18n.t('help', params), {
        reply_markup: mainKeyboard(ctx.i18n.locale()).reply_markup,
        disable_web_page_preview: true
    })
}

function mainKeyboard(language: string) {
    const play = m.button.callback('🧠 ' + i18n.t(language, 'quiz_button'), 'play')
    const results = m.button.callback('🏆 ' + i18n.t(language, 'results_button'), 'results')
    return m.keyboard([[play, results]]).resize()
}
