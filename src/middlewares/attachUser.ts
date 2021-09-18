import { VIZ } from '@/helpers/viz'
import { findUserByPollId, getOrCreateUser } from '@/models/index'
import { Context } from 'telegraf'

export async function attachUser(ctx: Context, next) {
  ctx.viz = new VIZ()
  if (ctx.from) {
    ctx.dbuser = await getOrCreateUser(ctx.from.id)
    return next()
  }
  if (ctx.poll) {
    ctx.dbuser = await findUserByPollId(ctx.poll.id)
    return next()
  }
}
