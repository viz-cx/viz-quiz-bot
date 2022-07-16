import { getSectionsByUser, SectionModel } from "@/models/Section";
import { Context } from "telegraf";
import { Markup as m } from 'telegraf';
import { Message } from "telegraf/typings/core/types/typegram";

export async function sendSelect(ctx: Context) {
    const userSections = await getSectionsByUser(ctx.dbuser.id)
    let ownSectionButtons = userSections.map((s) => {
        var title = s.title
        if (ctx.dbuser.selectedSection && ctx.dbuser.selectedSection.equals(s.id.toString())) {
            title = '✅' + title
        }
        return m.button.callback(title, s.id)
    })
    let unansweredSections = [] // TODO: list of buttons with unanswered quiz sections
    let buttons = [m.button.callback('🔧 ' + ctx.i18n.t('create_button'), 'create_button')]
        .concat(ownSectionButtons, unansweredSections)
    const keyboard = m.inlineKeyboard(buttons, { columns: 1 })
    await ctx.replyWithHTML('👉️ ' + ctx.i18n.t('select'), keyboard)
}

export async function createCallback(ctx: Context, next: () => any) {
    if (!ctx.callbackQuery) {
        return next()
    }
    let data = (ctx.callbackQuery as any).data
    switch (data) {
        case 'create_button':
            ctx.dbuser.state = 'wait_title'
            await ctx.dbuser.save()
            let keyboard = m.inlineKeyboard([m.button.callback(ctx.i18n.t('cancel_button'), 'cancel')])
            return await ctx.editMessageText(ctx.i18n.t('create_section_title'), keyboard)
            break
        default:
            return next()
    }
}

export async function waitTitleMiddleware(ctx: Context, next: () => any) {
    if (ctx.dbuser.state === 'wait_title' && ctx.message) {
        let text = (ctx.message as Message.TextMessage).text
        if (text === undefined || text.length === 0) {
            return ctx.reply(ctx.i18n.t('something_wrong'))
        }
        let section = new SectionModel()
        section.title = text
        section.authorId = ctx.dbuser.id
        try {
            let newSection = await section.save()
            ctx.dbuser.selectedSection = newSection
            ctx.dbuser.state = ''
            await ctx.dbuser.save()
            ctx.reply(ctx.i18n.t('section_created'))
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
