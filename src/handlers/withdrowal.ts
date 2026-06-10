import { getAllBalances } from "@/models/User"
import { MyContext } from "@/types/context"

export async function makeCheque(ctx: MyContext) {
    const viz = ctx.viz
    const account = process.env.ACCOUNT
    let chainAccount: Object
    try {
        chainAccount = await viz.getAccount(account)
    } catch (_) {
        viz.changeNode()
        await ctx.answerCallbackQuery({ text: ctx.i18n.t('something_wrong') })
        return
    }
    const allVIZes = parseFloat(chainAccount['balance'])
    const allBalances = await getAllBalances()
    const price = allBalances === 0 ? 0 : allVIZes / allBalances
    const userVIZes = ctx.dbuser.balance * price
    if (userVIZes <= 10) {
        await ctx.answerCallbackQuery({ text: ctx.i18n.t('not_enough') })
        return
    }
    const u = ctx.dbuser
    const prevBalance = u.balance
    const prevMultiplier = u.multiplier
    const prevResetedAt = u.resetedAt
    u.balance = 0
    u.multiplier = 0
    u.resetedAt = new Date()
    await u.save()
    try {
        await ctx.deleteMessage()
    } catch (_) { }
    const wif = process.env.WIF
    const amount = userVIZes.toFixed(3) + ' VIZ'
    const privateKey = viz.generateWif()
    const publicKey = viz.wifToPublic(privateKey)
    try {
        await viz.createInvite(wif, account, amount, publicKey)
        await ctx.reply(ctx.i18n.t('cheque', {
            viz: userVIZes.toFixed(2),
            code: privateKey
        }), { parse_mode: 'HTML', link_preview_options: { is_disabled: true } })
        console.log('Successfully created cheque with balance', amount, 'for user', u.id)
    } catch (_) {
        // Invite never reached the chain — give the points back
        u.balance = prevBalance
        u.multiplier = prevMultiplier
        u.resetedAt = prevResetedAt
        await u.save()
        await ctx.reply(ctx.i18n.t('something_wrong'))
        console.log('Failed to create invite for', u.id, 'with', amount, 'VIZ')
    }
}
