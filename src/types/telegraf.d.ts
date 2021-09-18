import I18N from 'telegraf-i18n'
import { User } from '@/models/User'
import { DocumentType } from '@typegoose/typegoose'
import { VIZ } from '@/helpers/viz'

declare module 'telegraf' {
  export class Context {
    dbuser: DocumentType<User>
    i18n: I18N
    viz: VIZ
  }
}
