import { prop, getModelForClass, DocumentType, mongoose } from '@typegoose/typegoose'
import { Base } from '@typegoose/typegoose/lib/defaultClasses'

export class Quiz extends Base<mongoose.Schema.Type.String> {
    @prop()
    question: string

    @prop({ type: () => [String] })
    answers: string[] // first is correct

    @prop({ required: false })
    explanation?: string

    @prop({ required: true })
    authorId: number

    @prop({ required: true, unique: true })
    pollId: string // in telegram, against duplicates
}

export const QuizModel = getModelForClass(Quiz, {
    schemaOptions: { timestamps: true },
})

export async function findQuizById(id: string): Promise<DocumentType<Quiz>> {
    return await QuizModel.findOne({ _id: id })
}

export async function findQuizByPollId(pollId: string): Promise<DocumentType<Quiz>> {
    return await QuizModel.findOne({ pollId: pollId })
}

export async function findUnasweredQuizzes(answeredIds: mongoose.Types.ObjectId[]): Promise<DocumentType<Quiz>> {
    return await QuizModel.aggregate([
        { $match: { _id: { "$nin": answeredIds } } },
        { $sample: { size: 10 } }
    ])
}

export async function getQuizCountAfterDate(date: Date = new Date(0)): Promise<number> {
    return await QuizModel.countDocuments({ createdAt: { $gte: date } }).exec()
}
