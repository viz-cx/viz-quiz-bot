import { findUser } from "@/models/User"
import { Context, Markup as m } from "telegraf"
import { i18n } from "@/helpers/i18n"

export function setupStart(ctx: Context) {
    const payload: string = (ctx as any)['startPayload']
    const referrer = parseInt(payload)
    var user = ctx.dbuser
    if (!user.referrer && !isNaN(referrer)) {
        if (user.id !== referrer) {
            findUser(referrer)
                .then(result => {
                    if (result) {
                        console.log("Add referrer", referrer, "to user", user.id)
                        user.referrer = referrer
                        user.save().then(u => {
                            payToReferrer(referrer, ctx)
                            payToReferrer(u.id, ctx)
                        })
                    } else {
                        console.log('Referrer', referrer, 'doesn\'t exists')
                    }
                }, err => console.log('Referrer error', referrer, err)
                )
        }
    } else {
        user.referrer = 1
        user.save()
    }
    return sendMainKeyboard(ctx)
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

function mainKeyboard(language: string) {
    const play = m.button.callback('🧠 ' + i18n.t(language, 'quiz_button'), 'play')
    const withdrawal = m.button.callback('🏦 ' + i18n.t(language, 'results_button'), 'results')
    return m.keyboard([[play, withdrawal]]).resize()
}

function payToReferrer(referrerId: number, ctx: Context) {
    findUser(referrerId)
        .then(user => {
            let add = 200
            user.balance = user.balance + add
            user.save()
                .then(u => {
                    let payload = { score: add, balance: u.balance }
                    ctx.telegram.sendMessage(u.id, ctx.i18n.t('success_pay_referral', payload))
                })
        })
}
