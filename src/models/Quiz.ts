import { prop, getModelForClass, DocumentType, mongoose, modelOptions } from '@typegoose/typegoose'
import { Base } from '@typegoose/typegoose/lib/defaultClasses'

@modelOptions({ schemaOptions: { collection: 'quizzes' } })
export class Quiz extends Base<mongoose.Schema.Type.String> {
    @prop({ minlength: 1, maxlength: 255 })
    question: string

    @prop({ type: String, required: true, default: [] })
    answers: mongoose.Types.Array<string> // first is correct

    @prop({ required: false })
    explanation?: string

    @prop({ required: true })
    authorId: number

    @prop({ required: false, unique: true, sparse: true })
    pollId: string // in telegram, against duplicates

    @prop({ required: false })
    sectionId?: mongoose.Types.ObjectId
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

export async function findQuizzesBySection(sectionId: mongoose.Types.ObjectId): Promise<DocumentType<Quiz[]>> {
    return await QuizModel.find({ sectionId: sectionId })
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
