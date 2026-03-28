import { Bot } from 'grammy'
import { MyContext } from '@/types/context'

export const bot = new Bot<MyContext>(process.env.TOKEN)
