import { prop, getModelForClass, DocumentType, mongoose } from '@typegoose/typegoose'
import { Base } from '@typegoose/typegoose/lib/defaultClasses';

export class Quiz extends Base<mongoose.Schema.Type.String> {
    @prop()
    question: string

    @prop({ type: String })
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

export async function findById(id: string) {
    return await QuizModel.findOne({ _id: id })
}

export async function findUnasweredQuizzes(answeredIds: mongoose.Types.ObjectId[]): Promise<DocumentType<Quiz>> {
    return await QuizModel.aggregate([
        { $match: { _id: { "$nin": answeredIds } } },
        { $sample: { size: 10 } }
    ])
}
