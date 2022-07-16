import { prop, getModelForClass, DocumentType } from '@typegoose/typegoose'
import { Quiz } from './Quiz'

export class Section {
    @prop({ required: true, minlength: 3, maxlength: 100 })
    title: string

    @prop({ required: true, type: () => [Quiz], default: [] })
    quizzes: [Quiz]

    @prop({ required: true })
    authorId: number

    // TODO: rating to sort sections
}

export const SectionModel = getModelForClass(Section, {
    schemaOptions: { timestamps: true },
})

export async function getSectionsByUser(authorId: number): Promise<DocumentType<Section[]>> {
    return await SectionModel.find({ authorId: authorId })
}
