import { addToBalance, findUser } from "@/models/User"
import { findSection } from "@/models/Section"
import { upsertTopicMembership } from "@/models/TopicMembership"
import { Context, Telegraf } from "telegraf"
import { sendMainKeyboard } from "@/helpers/keyboard"
import { mongoose } from "@typegoose/typegoose"

const TOPIC_INVITE_PREFIX = 't_'

export function setupStart(bot: Telegraf<Context>) {
    bot.start(async (ctx) => {
        const payload: string = (ctx as any)['startPayload']
        var user = ctx.dbuser
        if (!user) {
            console.log('User not found!')
            return sendMainKeyboard(ctx)
        }

        // Handle topic invite: ?start=t_<sectionId>_<inviterId>
        if (payload && payload.startsWith(TOPIC_INVITE_PREFIX)) {
            const parts = payload.slice(TOPIC_INVITE_PREFIX.length).split('_')
            if (parts.length === 2) {
                const sectionId = parts[0]
                const inviterId = parseInt(parts[1])
                if (sectionId && !isNaN(inviterId)) {
                    try {
                        const section = await findSection(sectionId)
                        if (section) {
                            const sid = new mongoose.Types.ObjectId(sectionId)
                            await upsertTopicMembership(sid, user.id, inviterId)
                            user.activeTopicSection = section
                            await user.save()
                            await ctx.replyWithHTML(ctx.i18n.t('topic_invite_joined', { topic: section.title }))
                        }
                    } catch (e) {
                        console.error('Topic invite error:', e)
                    }
                }
            }
            return sendMainKeyboard(ctx)
        }

        // Handle bot-level referral: ?start=<userId>
        const referrer = parseInt(payload)
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
