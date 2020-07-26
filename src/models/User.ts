import { prop, getModelForClass } from '@typegoose/typegoose'

export class User {
  @prop({ required: true, index: true, unique: true })
  id: number

  @prop({ required: true, default: 'en' })
  language: string

  // Airtable row ids
  @prop({ type: String  })
  answeredRecords: string[]

  @prop()
  quizMessageId?: number

  @prop()
  quizId?: string
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

export async function findUserByQuiz(quizId: string) {
  let user = await UserModel.findOne({ quizId })
  return user
}
