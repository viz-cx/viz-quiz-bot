import { getPublicSections, Section } from "@/models/Section"
import { getQuizCountBySection } from "@/models/Quiz"
import { upsertTopicMembership } from "@/models/TopicMembership"
import { DocumentType } from "@typegoose/typegoose/lib/types"
import { MyContext } from "@/types/context"
import { InlineKeyboard } from "grammy"
import { mongoose } from "@typegoose/typegoose"

export async function sendCatalogue(ctx: MyContext) {
    const sections = await getPublicSections()
    if (sections.length === 0) {
        return ctx.reply(ctx.i18n.t('catalogue_empty'))
    }

    const kb = new InlineKeyboard()
    for (const s of sections as any as DocumentType<Section>[]) {
        const count = await getQuizCountBySection(s._id)
        const label = `${s.title} (${count} квизов)`
        kb.text(label, 'join_' + s._id).row()
    }

    return ctx.reply(ctx.i18n.t('catalogue_title'), { reply_markup: kb })
}

export async function handleExitTopic(ctx: MyContext) {
    ctx.dbuser.activeTopicSection = undefined
    await ctx.dbuser.save()
    return ctx.reply(ctx.i18n.t('topic_exit_done'))
}
