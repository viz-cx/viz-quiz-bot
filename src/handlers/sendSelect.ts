import { CancelCallback } from "@/middlewares/cancelCallback";
import { findQuizById, findQuizzesBySection, Quiz, QuizModel } from "@/models/Quiz";
import { findSection, getSectionsByUser, Section, SectionModel } from "@/models/Section";
import { DocumentType } from "@typegoose/typegoose/lib/types";
import { Context, Markup } from "telegraf";
import { Markup as m } from 'telegraf';
import { InlineKeyboardMarkup, Message } from "telegraf/typings/core/types/typegram";

const delimiter = '_'

const waitSectionState = 'wait' + delimiter + 'section'
const waitQuestionState = 'wait' + delimiter + 'question'
const waitAnswerState = 'wait' + delimiter + 'answer'

const sectionPrefix = 'section' + delimiter
const questionPrefix = 'question' + delimiter
const answerPrefix = 'answer' + delimiter

export async function sendSelect(ctx: Context) {
    const sections = await getSectionsByUser(ctx.dbuser.id)
    let keyboard = sectionsKeyboard(sections, ctx)
    await ctx.replyWithHTML('👉️ ' + ctx.i18n.t('select'), keyboard)
}

export async function createCallback(ctx: Context, next: () => any) {
    if (!ctx.callbackQuery) {
        return next()
    }
    let data = (ctx.callbackQuery as any).data
    switch (data) {
        case 'back_sections':
            ctx.dbuser.state = ''
            await ctx.dbuser.save()
            const sections = await getSectionsByUser(ctx.dbuser.id)
            let k = sectionsKeyboard(sections, ctx)
            return await ctx.sendMessage(ctx.i18n.t('select'), k)
        case 'back_questions':
            ctx.dbuser.state = ''
            await ctx.dbuser.save()
            let section = await findSection(ctx.dbuser.selectedSection)
            let quizzes = await findQuizzesBySection(ctx.dbuser.selectedSection)
            let kb = questionsKeyboard(quizzes, ctx)
            return await ctx.sendMessage(ctx.i18n.t('section', { section: section.title }), { parse_mode: "MarkdownV2", reply_markup: kb.reply_markup })
        case 'create_button':
            ctx.dbuser.selectedSection = undefined
            ctx.dbuser.state = waitSectionState
            await ctx.dbuser.save()
            let keyboard = cancelKeyboard(ctx, CancelCallback.cancel_section)
            return await ctx.editMessageText(ctx.i18n.t('create_section_title'), keyboard)
        default:
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
                        let keyboard = questionsKeyboard(quizzes, ctx)
                        return await ctx.sendMessage(ctx.i18n.t('section', { section: selectedSection.title }), { parse_mode: "MarkdownV2", reply_markup: keyboard.reply_markup })
                    }
                    ctx.dbuser.selectedSection = selectedSection
                    ctx.dbuser.state = ''
                    await ctx.dbuser.save()
                    const sections = await getSectionsByUser(ctx.dbuser.id)
                    let keyboard = sectionsKeyboard(sections, ctx)
                    await ctx.editMessageReplyMarkup(keyboard.reply_markup)
                    break
                case questionPrefix:
                    if (id === 'new') {
                        ctx.dbuser.selectedQuestion = null
                        ctx.dbuser.state = waitQuestionState
                        await ctx.dbuser.save()
                        await ctx.sendMessage(ctx.i18n.t('create_question_wait'), { parse_mode: "MarkdownV2" })
                        return
                    }
                    let quiz = await findQuizById(id)
                    if (quiz.authorId !== ctx.dbuser.id) {
                        return ctx.reply(ctx.i18n.t('something_wrong'))
                    }
                    if (splitted[2] === 'update') {
                        ctx.dbuser.selectedQuestion = quiz
                        ctx.dbuser.state = waitQuestionState
                        await ctx.dbuser.save()
                        await ctx.sendMessage(ctx.i18n.t('update_question_wait', { oldQuestion: quiz.question }),
                            { parse_mode: "MarkdownV2" })
                        return next()
                    }
                    let kb = answersKeyboard(quiz, ctx)
                    await ctx.sendMessage(ctx.i18n.t('question', { question: quiz.question }), { parse_mode: "MarkdownV2", reply_markup: kb.reply_markup })
                    break
                case answerPrefix:
                    const answerId = Number(splitted[2])
                    if (Number.isNaN(answerId)) {
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
                    if (answer === undefined) {
                        await ctx.sendMessage(ctx.i18n.t('create_answer_wait'), cancelKeyboard(ctx, CancelCallback.cancel_question))
                    } else {
                        await ctx.sendMessage(ctx.i18n.t('update_answer_wait', { oldAnswer: answer }),
                            { parse_mode: "MarkdownV2", reply_markup: cancelKeyboard(ctx, CancelCallback.cancel_question).reply_markup })
                    }
                    break
                default:
                    return next()
            }
    }
}

export async function waitMiddleware(ctx: Context, next: () => any) {
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
                const sections = await getSectionsByUser(ctx.dbuser.id)
                let keyboard = sectionsKeyboard(sections, ctx)
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
            if (!ctx.dbuser.selectedQuestion) { // new question
                let answers = text.split('\n')
                let question = answers.shift()
                if (answers.length < 2) {
                    return ctx.reply(ctx.i18n.t('create_question_min'), cancelKeyboard(ctx, CancelCallback.cancel_question))
                }
                if (answers.length > 10) {
                    return ctx.reply(ctx.i18n.t('create_question_max'), cancelKeyboard(ctx, CancelCallback.cancel_question))
                }
                let quiz = new QuizModel()
                quiz.question = question
                quiz.answers = answers
                quiz.authorId = ctx.dbuser.id
                quiz.sectionId = ctx.dbuser.selectedSection
                let newQuiz = await quiz.save()

                ctx.dbuser.state = ''
                await ctx.dbuser.save()

                let kb = answersKeyboard(newQuiz, ctx)
                await ctx.sendMessage(ctx.i18n.t('create_question_result'), kb)
                return
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

            let kb = answersKeyboard(newQuiz, ctx)
            await ctx.sendMessage(ctx.i18n.t('update_question_result', { oldQuestion: old, newQuestion: newQuiz.question }),
                { parse_mode: "MarkdownV2", reply_markup: kb.reply_markup })
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
            let qq = await new QuizModel(q).save()

            ctx.dbuser.state = ''
            ctx.dbuser.selectedQuestion = null
            ctx.dbuser.selectedAnswer = null
            await ctx.dbuser.save()

            let keyboard = answersKeyboard(qq, ctx)
            if (oldAnswer === undefined) {
                await ctx.sendMessage(ctx.i18n.t('create_answer_result', { newAnswer: newAnswer }),
                    { parse_mode: "MarkdownV2", reply_markup: keyboard.reply_markup })
            } else {
                await ctx.sendMessage(ctx.i18n.t('update_answer_result', { oldAnswer: oldAnswer, newAnswer: newAnswer }),
                    { parse_mode: "MarkdownV2", reply_markup: keyboard.reply_markup })
            }
            break
        default:
            return next()
    }
}

export async function updateSectionTitleCallback(ctx: Context, next: () => any) {
    if (ctx.callbackQuery && (ctx.callbackQuery as any).data === 'create_section_title') {
        ctx.dbuser.state = waitSectionState
        await ctx.dbuser.save()
        let keyboard = cancelKeyboard(ctx, CancelCallback.cancel_section)
        return await ctx.editMessageText(ctx.i18n.t('create_section_title'), keyboard)
    } else {
        return next()
    }
}

function cancelKeyboard(ctx: Context, data: CancelCallback = CancelCallback.cancel) {
    return m.inlineKeyboard([m.button.callback(ctx.i18n.t('cancel_button'), data)])
}

export function sectionsKeyboard(sections: DocumentType<Section[]>, ctx: Context): Markup.Markup<InlineKeyboardMarkup> {
    let sectionButtons = sections.map((s: DocumentType<Section>) => {
        var title = s.title
        if (ctx.dbuser.selectedSection && ctx.dbuser.selectedSection.equals(s.id.toString())) {
            title = '✅' + title
        }
        return m.button.callback(title, sectionPrefix + s.id)
    })
    let buttons = [m.button.callback('🔧 ' + ctx.i18n.t('create_button'), 'create_button')]
        .concat(sectionButtons)
    return m.inlineKeyboard(buttons, { columns: 1 })
}

export function questionsKeyboard(quizzes: DocumentType<Quiz[]>, ctx: Context): Markup.Markup<InlineKeyboardMarkup> {
    let buttons = quizzes.map((q: DocumentType<Quiz>) => m.button.callback(q.question, questionPrefix + q._id))
    let keyboard = m.inlineKeyboard([
        m.button.callback('◀️ ' + ctx.i18n.t('back'), 'back_sections'),
        m.button.callback('✍️ ' + ctx.i18n.t('update_section_title'), 'create_section_title'),
        m.button.callback('👊 ' + ctx.i18n.t('create_question'), questionPrefix + 'new'),
        ...buttons
    ], { columns: 2 })
    return keyboard
}

function answersKeyboard(quiz: Quiz, ctx: Context): Markup.Markup<InlineKeyboardMarkup> {
    let buttons = quiz.answers.map((a: string, idx: number) => m.button.callback((idx === 0 ? '(✅) ' : '') + a, answerPrefix + quiz._id + delimiter + idx))
    if (buttons.length < 10) {
        buttons.push(m.button.callback(ctx.i18n.t('create_answer'), answerPrefix + quiz._id + delimiter + buttons.length))
    }
    let keyboard = m.inlineKeyboard([
        m.button.callback('◀️ ' + ctx.i18n.t('back'), 'back_questions'),
        m.button.callback('✍️ ' + ctx.i18n.t('update_question_title'), questionPrefix + quiz._id + delimiter + 'update'),
        ...buttons
    ], { columns: 2 })
    return keyboard
}
