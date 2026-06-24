import { prop, getModelForClass, mongoose, DocumentType, Ref } from '@typegoose/typegoose'
import { Quiz } from './Quiz'
import { Section } from './Section'

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

  @prop({ type: () => mongoose.Types.ObjectId, required: false, default: [] })
  answered: mongoose.Types.ObjectId[]

  @prop({ required: true, default: 0 })
  balance: number

  @prop({ required: true, default: 0 })
  multiplier: number

  // Anti-grind rate limiting (see checkAnswer). Timestamp of the last rewarded
  // answer, plus a rolling window counter that caps rewarded answers per period.
  @prop({ required: false })
  lastAnsweredAt?: Date

  @prop({ required: false })
  earnWindowStart?: Date

  @prop({ required: true, default: 0 })
  earnWindowCount: number

  @prop({ required: true, default: 0 })
  pendingAuthorIncome: number

  @prop({ required: true, default: 0 })
  pendingInviterIncome: number

  @prop({ required: false })
  digestDueAt?: Date

  // Authoritative expiry for the currently-served question. The in-memory
  // sendQuiz timer is UX-only; correctness/expiry is decided against this.
  @prop({ required: false })
  quizExpiresAt?: Date

  @prop({ required: true, default: new Date(0) })
  notifiedAt: Date

  @prop({ required: true, enum: Difficulty, type: Number, default: Difficulty.Normal })
  difficulty: Difficulty

  @prop({ required: true, default: new Date(0) })
  resetedAt: Date

  @prop({ required: false })
  state?: string

  @prop({ required: false, ref: () => Section })
  selectedSection?: Ref<Section>

  @prop({ required: false, ref: () => Section })
  activeTopicSection?: Ref<Section>

  @prop({ required: false, ref: () => Quiz })
  selectedQuestion?: Ref<Quiz>

  @prop({ required: false, min: 0, max: 10 })
  selectedAnswer: number

  // Maintained by schemaOptions.timestamps (not schema props)
  createdAt?: Date
  updatedAt?: Date
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

export async function accumulatePassiveIncome(
  userId: number,
  authorAmount: number,
  inviterAmount: number
): Promise<void> {
  const dueAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
  await UserModel.updateOne(
    { id: userId },
    [{
      $set: {
        pendingAuthorIncome: { $add: [{ $ifNull: ['$pendingAuthorIncome', 0] }, authorAmount] },
        pendingInviterIncome: { $add: [{ $ifNull: ['$pendingInviterIncome', 0] }, inviterAmount] },
        digestDueAt: { $ifNull: ['$digestDueAt', dueAt] },
      }
    }],
    { upsert: true }
  ).exec()
}

export async function getUsersCount(afterDate: Date = new Date(0)): Promise<number> {
  return await UserModel.countDocuments({ updatedAt: { $gt: afterDate } }).exec()
}

export async function getUsersNotifiedBefore(notificationDate: Date): Promise<DocumentType<User>[]> {
  return await UserModel.find({ notifiedAt: { $lte: notificationDate } }).exec()
}

export async function getRichestUser(): Promise<DocumentType<User>> {
  return await UserModel.findOne().sort({ "balance": -1 }).exec()
}
