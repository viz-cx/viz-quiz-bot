import { getPublicSections, Section } from "@/models/Section"
import { getQuizCountBySection } from "@/models/Quiz"
import { upsertTopicMembership } from "@/models/TopicMembership"
import { DocumentType } from "@typegoose/typegoose/lib/types"
import { Context, Markup as m } from "telegraf"
import { mongoose } from "@typegoose/typegoose"

export async function sendCatalogue(ctx: Context) {
    const sections = await getPublicSections()
    if (sections.length === 0) {
        return ctx.reply(ctx.i18n.t('catalogue_empty'))
    }

    const buttons = await Promise.all(
        sections.map(async (s: DocumentType<Section>) => {
            const count = await getQuizCountBySection(s._id)
            const label = `${s.title} (${count} квизов)`
            return m.button.callback(label, 'join_' + s._id)
        })
    )

    return ctx.reply(ctx.i18n.t('catalogue_title'), m.inlineKeyboard(buttons, { columns: 1 }))
}

export async function handleExitTopic(ctx: Context) {
    ctx.dbuser.activeTopicSection = undefined
    await ctx.dbuser.save()
    return ctx.reply(ctx.i18n.t('topic_exit_done'))
}
