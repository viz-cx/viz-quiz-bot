import { VIZ } from '@/helpers/viz'
import { findUserByPollId, getOrCreateUser } from '@/models/index'
import { Context } from 'telegraf'

const viz = new VIZ()

export async function attachUser(ctx: Context, next) {
  ctx.viz = viz
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
