import { prop, getModelForClass, mongoose, DocumentType } from '@typegoose/typegoose'

export enum Difficulty {
  Easy,
  Normal,
  Hard,
  Nightmare
}

export class User {
  @prop({ required: true, index: true, unique: true })
  id: number

  @prop({ required: true, default: 'ru' })
  language: string

  @prop({ required: false })
  referrer?: number

  @prop()
  quizMessageId?: number

  @prop({ required: false, index: true })
  pollId?: string // in telegram

  @prop()
  quizId?: mongoose.Types.ObjectId // in database, current

  @prop({ type: () => mongoose.Types.ObjectId })
  answered: mongoose.Types.ObjectId[]

  @prop({ required: true, default: 0 })
  balance: number

  @prop({ required: true, default: 0 })
  multiplier: number

  @prop({ required: true, default: new Date(0) })
  notifiedAt: Date

  @prop({ required: true, enum: Difficulty, type: Number, default: Difficulty.Normal })
  difficulty: Difficulty

  @prop({ required: true, default: new Date(0) })
  resetedAt: Date

  @prop({ required: false })
  state?: string
}

export const UserModel = getModelForClass(User, {
  schemaOptions: { timestamps: true },
})

export async function findUser(id: number) {
  return await UserModel.findOne({ id }).exec()
}

export async function getOrCreateUser(id: number) {
  let user = await UserModel.findOne({ id })
  if (!user) {
    try {
      user = await new UserModel({ id }).save()
    } catch (err) {
      console.error(err)
      user = await UserModel.findOne({ id })
    }
  }
  return user
}

export async function updateNotifiedDate(userId: number) {
  // directly to the MongoDB API, without Mongoose 
  return await UserModel.collection.findOneAndUpdate(
    { id: userId },
    { $set: { notifiedAt: new Date() } }
  )
}

export async function findUserByPollId(pollId: string) {
  return await UserModel.findOne({ pollId: pollId }).exec()
}

export async function getAllBalances(): Promise<number> {
  const result = await UserModel.aggregate([
    { $group: { _id: null, sum: { $sum: "$balance" } } }
  ]).exec()
  if (result.length === 0) {
    return 0
  }
  return parseFloat(result[0]["sum"])
}

export async function addToBalance(userId: number, add: number) {
  await UserModel.updateOne(
    { id: userId },
    {
      $inc: { balance: add }
    }, { upsert: true }
  ).exec()
}

export async function getUsersCount(afterDate: Date = new Date(0)): Promise<number> {
  return await UserModel.countDocuments({ updatedAt: { $gt: afterDate } }).exec()
}

export async function getUsersNotifiedBefore(notificationDate: Date): Promise<DocumentType<User[]>> {
  return await UserModel.find({
    $or: [
      { notifiedAt: "" }, { notifiedAt: { $lte: notificationDate } }
    ]
  }).exec()
}

export async function getRichestUser(): Promise<DocumentType<User>> {
  return await UserModel.findOne().sort({ "balance": -1 }).exec()
}
