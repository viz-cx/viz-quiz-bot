import { localeActions } from './handlers/language'
// Setup @/ aliases for modules
import 'module-alias/register'
// Config dotenv
import * as dotenv from 'dotenv'
dotenv.config({ path: `${__dirname}/../.env` })
// Dependencies
import { bot } from '@/helpers/bot'
import { ignoreOldMessageUpdates } from '@/middlewares/ignoreOldMessageUpdates'
import { setupStart } from '@/handlers/setupStart'
import { i18n, attachI18N } from '@/helpers/i18n'
import { setLanguage, sendLanguage } from '@/handlers/language'
import { attachUser } from '@/middlewares/attachUser'
import { sendQuiz } from '@/handlers/sendQuiz'
import { sendResults } from '@/handlers/sendResults'
import { checkAnswer } from '@/middlewares/checkAnswer'
import { nextQuestionCallback } from '@/middlewares/nextQuestionCallback'
import { approveQuiz } from '@/middlewares/approveQuiz'
import { proposeQuiz } from './middlewares/proposeQuiz'
import { startUnstaking } from './unstake'
import { startSelfAwarding } from './selfAward'
import { makeCheque } from './handlers/widthdrowal'
import { sendStats } from './handlers/sendStats'
import { startNotifications } from './sendNotifications'
import { Telegraf } from 'telegraf'
import { TlsOptions } from 'tls'
import { difficultyEmojies, sendDifficulty, setDifficulty } from './handlers/difficulty'
import { sendInfo } from './handlers/sendInfo'
import { resetCallback, sendReset } from './handlers/sendReset'

// Middlewares
bot.use(ignoreOldMessageUpdates)
bot.use(attachUser)
bot.use(i18n.middleware(), attachI18N)
bot.use(checkAnswer)
bot.use(nextQuestionCallback)
bot.use(approveQuiz)
bot.use(proposeQuiz)
bot.use(resetCallback)
// Commands
bot.command('language', sendLanguage)
bot.command(['stats', 'stat'], sendStats)
bot.command('reset', sendReset)
// Actions
bot.action(localeActions, setLanguage)
bot.action(difficultyEmojies, setDifficulty)
bot.action('💰', makeCheque)
// Errors
bot.catch(console.error)
// Hears
bot.hears(new RegExp('🧠 .*'), async ctx => sendQuiz(ctx))
bot.hears(new RegExp('🏦 .*'), async ctx => sendResults(ctx))
bot.hears(new RegExp('⌛️ .*'), async ctx => sendDifficulty(ctx))
bot.hears(new RegExp('ℹ️ .*'), async ctx => sendInfo(ctx))
// Start bot
setupStart(bot)

bot.launch().then(() => {
  console.info(`Bot ${bot.botInfo.username} is up and running`)
  startSelfAwarding()
  startUnstaking()
  startNotifications()
})
