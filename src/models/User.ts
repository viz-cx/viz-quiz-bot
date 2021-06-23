import { prop, getModelForClass, Ref } from '@typegoose/typegoose'
import { Quiz } from './Quiz'

export class User {
  @prop({ required: true, index: true, unique: true })
  id: number

  @prop({ required: true, default: 'ru' })
  language: string

  @prop({ required: false })
  referrer?: number

  @prop({ type: String })
  answeredRecords: string[]

  @prop()
  quizMessageId?: number

  @prop({ required: false, index: true })
  pollId?: string // in telegram

  @prop({ ref: () => Quiz })
  quizId?: Ref<Quiz> // in database
}

const UserModel = getModelForClass(User, {
  schemaOptions: { timestamps: true },
})

export async function findUser(id: number) {
  let user = await UserModel.findOne({ id })
  if (!user) {
    try {
      user = await new UserModel({ id }).save()
    } catch (err) {
      user = await UserModel.findOne({ id })
    }
  }
  return user
}

export async function findUserByPollId(pollId: string) {
  let user = await UserModel.findOne({ pollId: pollId })
  return user
}
