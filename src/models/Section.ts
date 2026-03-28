import { prop, getModelForClass, DocumentType } from '@typegoose/typegoose'
import { Quiz } from './Quiz'

export class Section {
    @prop({ required: true, minlength: 3, maxlength: 100 })
    title: string

    @prop({ required: true, type: () => [Quiz], default: [] })
    quizzes: [Quiz]

    @prop({ required: true })
    authorId: number

    @prop({ required: true, default: false })
    isPublic: boolean

    @prop({ required: false, maxlength: 200 })
    description?: string
}

export const SectionModel = getModelForClass(Section, {
    schemaOptions: { timestamps: true },
})

export async function getSectionsByUser(authorId: number): Promise<DocumentType<Section[]>> {
    return await SectionModel.find({ authorId: authorId })
}

export async function findSection(id: string): Promise<DocumentType<Section>> {
    return await SectionModel.findOne({ _id: id }).exec()
}

export async function getPublicSections(): Promise<DocumentType<Section[]>> {
    return await SectionModel.find({ isPublic: true }).sort({ updatedAt: -1 }).exec()
}
