import { prop, getModelForClass, index, mongoose } from '@typegoose/typegoose'

@index({ sectionId: 1, userId: 1 }, { unique: true })
export class TopicMembership {
    @prop({ required: true })
    sectionId: mongoose.Types.ObjectId

    @prop({ required: true })
    userId: number

    @prop({ required: true, default: 0 })
    inviterId: number // 0 = self-discovered (no inviter)
}

export const TopicMembershipModel = getModelForClass(TopicMembership, {
    schemaOptions: {
        timestamps: true,
        collection: 'topicmemberships',
    },
})

export async function getInviterForTopic(
    sectionId: mongoose.Types.ObjectId,
    userId: number
): Promise<number> {
    const membership = await TopicMembershipModel.findOne({ sectionId, userId }).exec()
    return membership ? membership.inviterId : 0
}

export async function upsertTopicMembership(
    sectionId: mongoose.Types.ObjectId,
    userId: number,
    inviterId: number
): Promise<void> {
    await TopicMembershipModel.updateOne(
        { sectionId, userId },
        { $setOnInsert: { inviterId } },
        { upsert: true }
    ).exec()
}
