import { readdirSync, readFileSync } from 'fs'
import { safeLoad } from 'js-yaml'
import { MyContext, I18N } from '@/types/context'
import { NextFunction } from 'grammy'

const localesDir = `${__dirname}/../../locales`

// Load all locale YAML files into memory
const translations: Record<string, Record<string, string>> = {}

for (const file of readdirSync(localesDir)) {
    const lang = file.split('.')[0]
    const content = safeLoad(readFileSync(`${localesDir}/${file}`, 'utf8')) as Record<string, string>
    translations[lang] = content
}

function interpolate(template: string, params: Record<string, unknown> = {}): string {
    return template.replace(/\$\{(\w+)\}/g, (_, key) => {
        return params[key] !== undefined ? String(params[key]) : `\${${key}}`
    }).replace(/\{(\w+)\}/g, (_, key) => {
        return params[key] !== undefined ? String(params[key]) : `{${key}}`
    })
}

class I18NInstance implements I18N {
    private _locale: string

    constructor(defaultLocale: string = 'ru') {
        this._locale = defaultLocale
    }

    t(key: string, params?: Record<string, unknown>): string {
        const dict = translations[this._locale] || translations['ru'] || {}
        const template = dict[key]
        if (!template) return key
        return interpolate(template, params)
    }

    locale(): string
    locale(lang: string): void
    locale(lang?: string): string | void {
        if (lang === undefined) return this._locale
        this._locale = lang
    }
}

// Static t() for use outside of context (e.g., notifications)
export function t(language: string, key: string, params?: Record<string, unknown>): string {
    const dict = translations[language] || translations['ru'] || {}
    const template = dict[key]
    if (!template) return key
    return interpolate(template, params)
}

export function i18nMiddleware(ctx: MyContext, next: NextFunction) {
    ctx.i18n = new I18NInstance()
    return next()
}

export function attachI18N(ctx: MyContext, next: NextFunction) {
    if (ctx.dbuser) {
        ctx.i18n.locale(ctx.dbuser.language)
    }
    return next()
}
