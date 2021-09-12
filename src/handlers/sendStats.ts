import { getUsersCount } from "@/models";
import { Context } from "telegraf/typings/context";


export function sendStats(ctx: Context) {
    const start = new Date(0)
    const prevMonth = new Date()
    prevMonth.setDate(1)
    prevMonth.setMonth(prevMonth.getMonth()-1)
    Promise.all([
        getUsersCount(start),
        getUsersCount(prevMonth)
    ]).then(results => {
        const params = {
            'all': results[0],
            'month': results[1]
        }
        ctx.replyWithHTML(ctx.i18n.t('stats', params))
    })
  }
