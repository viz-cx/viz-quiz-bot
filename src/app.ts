import { localeActions } from './handlers/language'
// Setup @/ aliases for modules
import 'module-alias/register'
// Config dotenv
import * as dotenv from 'dotenv'
dotenv.config({ path: `${__dirname}/../.env` })
// Dependencies
import { bot } from '@/helpers/bot'
import { ignoreOldMessageUpdates } from '@/middlewares/ignoreOldMessageUpdates'
import { sendStart } from '@/handlers/sendStart'
import { i18n, attachI18N } from '@/helpers/i18n'
import { setLanguage, sendLanguage } from '@/handlers/language'
import { attachUser } from '@/middlewares/attachUser'
import { sendQuiz } from '@/handlers/sendQuiz'
import { checkAnswer } from '@/middlewares/checkAnswer'
import { nextQuestionCallback } from '@/middlewares/nextQuestionCallback'
import { proposeQuiz } from '@/middlewares/proposeQuiz'

// Middlewares
bot.use(ignoreOldMessageUpdates)
bot.use(attachUser)
bot.use(i18n.middleware(), attachI18N)
bot.use(checkAnswer)
bot.use(nextQuestionCallback)
bot.use(proposeQuiz)
// Commands
bot.command('start', sendStart)
bot.command('language', sendLanguage)
// Actions
bot.action(localeActions, setLanguage)
// Errors
bot.catch(console.error)
// Hears
bot.hears(new RegExp('🧠 .*'), async ctx => sendQuiz(ctx))
// Start bot
bot.launch().then(() => {
  console.info(`Bot ${bot.botInfo.username} is up and running`)
})
