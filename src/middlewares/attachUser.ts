import { findUser, findUserByPollId } from '../models'
import { Context } from 'telegraf'

export async function attachUser(ctx: Context, next) {
  const userId = ctx.from?.id
  if (!userId && ctx.poll?.id !== undefined) {
    ctx.dbuser = await findUserByPollId(ctx.poll.id)
    return next()
  }
  ctx.dbuser = await findUser(userId)
  return next()
}
