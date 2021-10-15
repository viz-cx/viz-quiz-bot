import { addToBalance, findUser } from "@/models/User"
import { Context, Telegraf } from "telegraf"
import { sendMainKeyboard } from "@/helpers/keyboard"

export function setupStart(bot: Telegraf<Context>) {
    bot.start((ctx) => {
        const payload: string = (ctx as any)['startPayload']
        const referrer = parseInt(payload)
        var user = ctx.dbuser
        if (!user) {
            console.log('User not found!')
            return sendMainKeyboard(ctx)
        }
        if (!user.referrer && !isNaN(referrer)) {
            if (user.id !== referrer) {
                findUser(referrer)
                    .then(result => {
                        if (result) {
                            console.log("Add referrer", referrer, "to user", user.id)
                            user.referrer = referrer
                            user.save().then(u => {
                                payToReferrer(referrer, ctx)
                                payToReferral(u.id, ctx)
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
    })
}

function payToReferrer(referrerId: number, ctx: Context) {
    let add = 1000
    addToBalance(referrerId, add)
        .then(_ => {
            findUser(referrerId).then(u => {
                let payload = { score: add, balance: u.balance }
                ctx.telegram.sendMessage(u.id, ctx.i18n.t('success_pay_referrer', payload))
            })
        })
}

function payToReferral(referralId: number, ctx: Context) {
    let add = 1000
    addToBalance(referralId, add)
        .then(_ => {
            findUser(referralId)
                .then(u => {
                    let payload = { score: add, balance: u.balance }
                    ctx.telegram.sendMessage(u.id, ctx.i18n.t('success_pay_referral', payload))
                })
        })
}
