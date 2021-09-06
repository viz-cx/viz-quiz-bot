import { findUser, findUserByPollId, getOrCreateUser } from '@/models/index'
import { Context } from 'telegraf'

export async function attachUser(ctx: Context, next) {
  if (ctx.from) {
    ctx.dbuser = await getOrCreateUser(ctx.from.id)
    return next()
  }
  if (ctx.poll) {
    ctx.dbuser = await findUserByPollId(ctx.poll.id)
    return next()
  }
}
