import { MyContext } from '@/types/context'
import { NextFunction } from 'grammy'

export async function ignoreOldMessageUpdates(ctx: MyContext, next: NextFunction) {
  if (ctx.message) {
    if (new Date().getTime() / 1000 - ctx.message.date < 5 * 60) {
      return next()
    } else {
      console.log(
        `Ignoring message from ${ctx.from.id} at ${ctx.chat.id} (${
          new Date().getTime() / 1000
        }:${ctx.message.date})`
      )
    }
  } else {
    return next()
  }
}
