import { getUsersCount, getQuizCountAfterDate, getAllBalances, getRichestUser } from "@/models";
import { MyContext } from "@/types/context";

export function sendStats(ctx: MyContext) {
    const zeroDate = new Date(0)
    const monthAgo = new Date(new Date().setDate(new Date().getDate() - 30))
    Promise.all([
        getUsersCount(zeroDate),
        getUsersCount(monthAgo),
        getQuizCountAfterDate(zeroDate),
        getQuizCountAfterDate(monthAgo),
        getAllBalances(),
        ctx.viz.getAccount(process.env.ACCOUNT),
        getRichestUser()
    ]).then(results => {
        let allBalances = results[4]
        let allVIZes = parseFloat(results[5]['balance'])
        let price = allVIZes / allBalances
        let richest = results[6]['balance']
        const params = {
            'users': results[0],
            'monthUsers': results[1],
            'quizzes': results[2],
            'monthQuizzes': results[3],
            'allBalances': allBalances,
            'viz': allVIZes.toFixed(2),
            'price': price.toFixed(6),
            'richest': richest
        }
        ctx.reply(ctx.i18n.t('stats', params), { parse_mode: 'HTML' })
    })
}
