import { findUser, findUserByQuiz } from '../models'
import { Context } from 'telegraf'

export async function attachUser(ctx: Context, next) {
  const userId = ctx.from?.id
  if (!userId && ctx.poll?.id !== undefined) {
    ctx.dbuser = await findUserByQuiz(ctx.poll.id)
    next()
    return
  }
  ctx.dbuser = await findUser(userId)
  next()
}
