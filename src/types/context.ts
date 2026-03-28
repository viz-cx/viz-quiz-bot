import { Context } from 'grammy'
import { DocumentType } from '@typegoose/typegoose'
import { User } from '@/models/User'
import { VIZ } from '@/helpers/viz'

export interface I18N {
    t(key: string, params?: Record<string, unknown>): string
    locale(): string
    locale(lang: string): void
}

export interface MyContext extends Context {
    dbuser: DocumentType<User>
    i18n: I18N
    viz: VIZ
}
