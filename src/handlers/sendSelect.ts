import { findQuizById, findQuizzesBySection } from "@/models/Quiz";
import { findSection, getSectionsByUser, Section, SectionModel } from "@/models/Section";
import { Ref } from "@typegoose/typegoose";
import { Context } from "telegraf";
import { Markup as m } from 'telegraf';
import { Message } from "telegraf/typings/core/types/typegram";

const sectionPrefix = 'section_'
const questionPrefix = 'question_'

export async function sendSelect(ctx: Context) {
    let keyboard = await selectKeyboard(ctx)
    await ctx.replyWithHTML('👉️ ' + ctx.i18n.t('select'), keyboard)
}

export async function createCallback(ctx: Context, next: () => any) {
    if (!ctx.callbackQuery) {
        return next()
    }
    let data = (ctx.callbackQuery as any).data
    switch (data) {
        case 'create_button':
            ctx.dbuser.selectedSection = undefined
            ctx.dbuser.state = 'wait_title'
            await ctx.dbuser.save()
            let keyboard = cancelKeyboard(ctx)
            return await ctx.editMessageText(ctx.i18n.t('create_section_title'), keyboard)
        default:
            const delimiter = '_'
            const splitted = data.split(delimiter)
            if (splitted.length !== 2) {
                return next()
            }
            const prefix = splitted[0] + delimiter
            const id = splitted[1]
            if (prefix === undefined || prefix.length === 0 || id === undefined || id.length === 0) {
                return next()
            }
            switch (prefix) {
                case sectionPrefix:
                    let selectedSection = await findSection(id)
                    let isAlreadySelected = ctx.dbuser.selectedSection
                        && ctx.dbuser.selectedSection.equals(selectedSection.id.toString())
                    if (isAlreadySelected) {
                        let quizzes = await findQuizzesBySection(selectedSection._id)
                        let buttons = quizzes.map(q => m.button.callback(q.question, questionPrefix + q._id))
                        let keyboard = m.inlineKeyboard([
                            m.button.callback(ctx.i18n.t('update_section_title'), 'create_section_title'),
                            ...buttons
                        ], { columns: 1 })
                        return await ctx.sendMessage(selectedSection.title, keyboard)
                    }
                    ctx.dbuser.selectedSection = selectedSection
                    ctx.dbuser.state = ''
                    await ctx.dbuser.save()
                    let keyboard = await selectKeyboard(ctx)
                    await ctx.editMessageReplyMarkup(keyboard.reply_markup)
                    break
                case questionPrefix:
                    let quiz = await findQuizById(id)
                    console.log(quiz)
                    break
                default:
                    return next()
            }
    }
}

export async function waitTitleMiddleware(ctx: Context, next: () => any) {
    if (ctx.dbuser.state === 'wait_title' && ctx.message) {
        let text = (ctx.message as Message.TextMessage).text
        if (text === undefined || text.length === 0) {
            return ctx.reply(ctx.i18n.t('something_wrong'))
        }
        let section: Ref<Section>
        let successMessage: string
        if (ctx.dbuser.selectedSection) {
            section = await findSection(ctx.dbuser.selectedSection._id)
            successMessage = ctx.i18n.t('section_updated')
        } else {
            section = new SectionModel()
            section.authorId = ctx.dbuser.id
            successMessage = ctx.i18n.t('section_created')
        }
        section.title = text
        try {
            let newSection = await section.save()
            ctx.dbuser.selectedSection = newSection
            ctx.dbuser.state = ''
            await ctx.dbuser.save()
            let keyboard = await selectKeyboard(ctx)
            await ctx.reply(successMessage, keyboard)
        } catch (e) {
            console.log(e)
            let msg = e["message"]
            if (msg) {
                ctx.reply(msg)
            }
        }
    } else {
        return next()
    }
}

function cancelKeyboard(ctx: Context) {
    return m.inlineKeyboard([m.button.callback(ctx.i18n.t('cancel_button'), 'cancel')])
}

export async function selectKeyboard(ctx: Context) {
    const userSections = await getSectionsByUser(ctx.dbuser.id)
    let ownSectionButtons = userSections.map((s) => {
        var title = s.title
        if (ctx.dbuser.selectedSection && ctx.dbuser.selectedSection.equals(s.id.toString())) {
            title = '✅' + title
        }
        return m.button.callback(title, sectionPrefix + s.id)
    })
    let unansweredSections = [] // TODO: list of buttons with unanswered quiz sections
    let buttons = [m.button.callback('🔧 ' + ctx.i18n.t('create_button'), 'create_button')]
        .concat(ownSectionButtons, unansweredSections)
    const keyboard = m.inlineKeyboard(buttons, { columns: 1 })
    return keyboard
}

export async function updateSectionTitleCallback(ctx: Context, next: () => any) {
    if (ctx.callbackQuery && (ctx.callbackQuery as any).data === 'create_section_title') {
        ctx.dbuser.state = 'wait_title'
        await ctx.dbuser.save()
        let keyboard = cancelKeyboard(ctx)
        return await ctx.editMessageText(ctx.i18n.t('create_section_title'), keyboard)
    } else {
        return next()
    }
}
