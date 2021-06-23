import { prop, getModelForClass } from '@typegoose/typegoose'

export class Quiz {
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
