import { VIZ } from '@/helpers/viz'
import { findUserByPollId, getOrCreateUser } from '@/models/index'
import { MyContext } from '@/types/context'
import { NextFunction } from 'grammy'

export async function attachUser(ctx: MyContext, next: NextFunction) {
  ctx.viz = VIZ.origin
  if (ctx.poll) {
    ctx.dbuser = await findUserByPollId(ctx.poll.id)
    if (ctx.dbuser !== null) {
      return next()
    }
  }
  if (ctx.from) {
    ctx.dbuser = await getOrCreateUser(ctx.from.id)
    return next()
  }
  console.log("NO USER ATTACHED!")
}
