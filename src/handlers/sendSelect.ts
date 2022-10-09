import { findQuizById, findQuizzesBySection, QuizModel } from "@/models/Quiz";
import { findSection, getSectionsByUser, SectionModel } from "@/models/Section";
import { Context } from "telegraf";
import { Markup as m } from 'telegraf';
import { Message } from "telegraf/typings/core/types/typegram";

const waitSectionState = 'wait_section'
const waitQuestionState = 'wait_question'
const waitAnswerState = 'wait_answer'

const sectionPrefix = 'section_'
const questionPrefix = 'question_'
const answerPrefix = 'answer_'

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
            ctx.dbuser.state = waitSectionState
            await ctx.dbuser.save()
            let keyboard = cancelKeyboard(ctx)
            return await ctx.editMessageText(ctx.i18n.t('create_section_title'), keyboard)
        default:
            const delimiter = '_'
            const splitted = data.split(delimiter)
            if (splitted.length < 2) {
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
                    if (selectedSection.authorId !== ctx.dbuser.id) {
                        return ctx.reply(ctx.i18n.t('something_wrong'))
                    }
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
                    if (quiz.authorId !== ctx.dbuser.id) {
                        return ctx.reply(ctx.i18n.t('something_wrong'))
                    }
                    let postfix = 'update'
                    if (splitted[2] === postfix) {
                        ctx.dbuser.selectedQuestion = quiz
                        ctx.dbuser.state = waitQuestionState
                        await ctx.dbuser.save()
                        await ctx.sendMessage(ctx.i18n.t('update_question_wait', { oldQuestion: quiz.question }),
                            { parse_mode: "MarkdownV2" })
                        return next()
                    }
                    let buttons = quiz.answers.map((a, idx) => m.button.callback((idx === 0 ? '(✅) ': '') + a, answerPrefix + quiz._id + delimiter + idx))
                    let kb = m.inlineKeyboard([
                        m.button.callback(ctx.i18n.t('update_question_title'), questionPrefix + quiz._id + delimiter + postfix),
                        ...buttons
                    ], { columns: 1 })
                    await ctx.sendMessage(quiz.question, kb)
                    break
                case answerPrefix:
                    const answerId = Number(splitted[2])
                    if (answerId === NaN) {
                        return ctx.reply(ctx.i18n.t('something_wrong'))
                    }
                    let q = await findQuizById(id)
                    let answer = q.answers[answerId]
                    if (q.authorId !== ctx.dbuser.id) {
                        return ctx.reply(ctx.i18n.t('something_wrong'))
                    }
                    ctx.dbuser.selectedQuestion = q
                    ctx.dbuser.state = waitAnswerState
                    ctx.dbuser.selectedAnswer = answerId
                    await ctx.dbuser.save()
                    await ctx.sendMessage(ctx.i18n.t('update_answer_wait', { oldAnswer: answer }),
                        { parse_mode: "MarkdownV2" })
                    break
                default:
                    return next()
            }
    }
}

export async function waitTitleMiddleware(ctx: Context, next: () => any) {
    if (!ctx.message || !ctx.dbuser.state) {
        return next()
    }
    let text = (ctx.message as Message.TextMessage).text
    if (text === undefined || text.length === 0) {
        return ctx.reply(ctx.i18n.t('something_wrong'))
    }
    switch (ctx.dbuser.state) {
        case waitSectionState:
            let section: any
            let successMessage: string
            if (ctx.dbuser.selectedSection) {
                section = await findSection(ctx.dbuser.selectedSection._id)
                if (section.authorId !== ctx.dbuser.id) {
                    return ctx.reply(ctx.i18n.t('something_wrong'))
                }
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
                    await ctx.reply(msg)
                }
            }
            break
        case waitQuestionState:
            console.log("Edit question title for", ctx.dbuser.selectedQuestion)
            if (!ctx.dbuser.selectedQuestion) {
                return ctx.reply(ctx.i18n.t('something_wrong'))
            }
            let quiz = await findQuizById(ctx.dbuser.selectedQuestion)
            if (quiz.authorId !== ctx.dbuser.id) {
                return ctx.reply(ctx.i18n.t('something_wrong'))
            }
            let old = quiz.question
            quiz.question = text
            let newQuiz = await quiz.save()
            ctx.dbuser.selectedQuestion = null
            ctx.dbuser.state = ''
            await ctx.dbuser.save()
            await ctx.sendMessage(ctx.i18n.t('update_question_result', { oldQuestion: old, newQuestion: newQuiz.question }),
                { parse_mode: "MarkdownV2" })
            break
        case waitAnswerState:
            console.log("Edit answer for", ctx.dbuser.selectedQuestion, "with id", ctx.dbuser.selectedAnswer)
            if (!ctx.dbuser.selectedQuestion) {
                return ctx.reply(ctx.i18n.t('something_wrong'))
            }
            let q = await findQuizById(ctx.dbuser.selectedQuestion)
            if (q.authorId !== ctx.dbuser.id) {
                return ctx.reply(ctx.i18n.t('something_wrong'))
            }
            let answerId = ctx.dbuser.selectedAnswer
            if (answerId == null) {
                return ctx.reply(ctx.i18n.t('something_wrong'))
            }

            var answers = q.answers
            let oldAnswer = answers[answerId]
            let newAnswer = text
            answers[answerId] = newAnswer
            q.answers = answers
            await new QuizModel(q).save()
            
            ctx.dbuser.state = ''
            ctx.dbuser.selectedQuestion = null
            ctx.dbuser.selectedAnswer = null
            await ctx.dbuser.save()
            await ctx.sendMessage(ctx.i18n.t('update_answer_result', { oldAnswer: oldAnswer, newAnswer: newAnswer }),
                { parse_mode: "MarkdownV2" })
            break
        default:
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
        ctx.dbuser.state = waitSectionState
        await ctx.dbuser.save()
        let keyboard = cancelKeyboard(ctx)
        return await ctx.editMessageText(ctx.i18n.t('create_section_title'), keyboard)
    } else {
        return next()
    }
}
