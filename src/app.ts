// Config dotenv
import * as dotenv from 'dotenv'
dotenv.config({ path: `${__dirname}/../.env` })
import { bot } from './helpers/bot'
import { checkAnswer } from './middlewares/checkAnswer'
import { checkTime } from './middlewares/checkTime'
import { setupHelp } from './commands/help'
import { setupStart } from './commands/start'
import { setupI18N } from './helpers/i18n'
import { setupLanguage } from './commands/language'
import { attachUser } from './middlewares/attachUser'

bot.use(checkAnswer)
// Check time
bot.use(checkTime)
// Attach user
bot.use(attachUser)
// Setup localization
setupI18N(bot)
// Setup commands
setupStart(bot)
setupHelp(bot)
setupLanguage(bot)

// Start bot
bot.startPolling()

// Log
console.info('Bot is up and running')
