import { MyContext } from '@/types/context'
import { InlineKeyboard } from 'grammy'
import { readdirSync, readFileSync } from 'fs'
import { safeLoad } from 'js-yaml'

export const localeActions = localesFiles().map((file) => file.split('.')[0])

export function sendLanguage(ctx: MyContext) {
  return ctx.reply(ctx.i18n.t('language'), { reply_markup: languageKeyboard() })
}

export async function setLanguage(ctx: MyContext) {
  if (ctx.callbackQuery && 'data' in ctx.callbackQuery) {
    let user = ctx.dbuser
    user.language = ctx.callbackQuery.data
    user = await (user as any).save()

    ctx.i18n.locale(ctx.callbackQuery.data)

    await ctx.editMessageText(
      ctx.i18n.t('language_selected'),
      { parse_mode: 'HTML' }
    )
  }
}

function languageKeyboard() {
  const locales = localesFiles()
  const kb = new InlineKeyboard()
  locales.forEach((locale, index) => {
    const localeCode = locale.split('.')[0]
    const localeName = safeLoad(
      readFileSync(`${__dirname}/../../locales/${locale}`, 'utf8')
    ).name
    kb.text(localeName, localeCode)
    if (index % 2 === 1 && index < locales.length - 1) {
      kb.row()
    }
  })
  return kb
}

function localesFiles() {
  return readdirSync(`${__dirname}/../../locales`)
}
