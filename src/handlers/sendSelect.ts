import { CancelCallback } from "@/middlewares/cancelCallback";
import { findQuizById, findQuizzesBySection, Quiz, QuizModel } from "@/models/Quiz";
import { findSection, getSectionsByUser, Section, SectionModel } from "@/models/Section";
import { DocumentType } from "@typegoose/typegoose/lib/types";
import { MyContext } from "@/types/context";
import { InlineKeyboard } from "grammy";
import { InlineKeyboardMarkup } from "@grammyjs/types";
import { NextFunction } from "grammy";
import { mongoose } from "@typegoose/typegoose";

const delimiter = '_'

const waitSectionState = 'wait' + delimiter + 'section'
const waitQuestionState = 'wait' + delimiter + 'question'
const waitAnswerState = 'wait' + delimiter + 'answer'

const sectionPrefix = 'section' + delimiter
const questionPrefix = 'question' + delimiter
const answerPrefix = 'answer' + delimiter

export async function sendSelect(ctx: MyContext) {
    const sections = await getSectionsByUser(ctx.dbuser.id)
    let keyboard = sectionsKeyboard(sections, ctx)
    await ctx.reply('👉️ ' + ctx.i18n.t('select'), { parse_mode: 'HTML', ...keyboard })
}

export async function createCallback(ctx: MyContext, next: NextFunction) {
    if (!ctx.callbackQuery) {
        return next()
    }
    let data = 'data' in ctx.callbackQuery ? ctx.callbackQuery.data : undefined
    if (!data) return next()

    switch (data) {
        case 'back_sections':
            ctx.dbuser.state = ''
            await ctx.dbuser.save()
            const sections = await getSectionsByUser(ctx.dbuser.id)
            let k = sectionsKeyboard(sections, ctx)
            return await ctx.reply(ctx.i18n.t('select'), k)
        case 'back_questions':
            ctx.dbuser.state = ''
            await ctx.dbuser.save()
            const backSection = await findSection(ctx.dbuser.selectedSection as any)
            let quizzes = await findQuizzesBySection(ctx.dbuser.selectedSection as any)
            let kb = questionsKeyboard(quizzes, backSection, ctx)
            return await ctx.reply(ctx.i18n.t('section', { section: backSection.title }), { parse_mode: "MarkdownV2", reply_markup: kb.reply_markup })
        case 'create_button':
            ctx.dbuser.selectedSection = undefined
            ctx.dbuser.state = waitSectionState
            await ctx.dbuser.save()
            let keyboard = cancelKeyboard(ctx, CancelCallback.cancel_section)
            return await ctx.editMessageText(ctx.i18n.t('create_section_title'), { reply_markup: keyboard.reply_markup })
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
                        let keyboard = questionsKeyboard(quizzes, selectedSection, ctx)
                        return await ctx.reply(ctx.i18n.t('section', { section: selectedSection.title }), { parse_mode: "MarkdownV2", reply_markup: keyboard.reply_markup })
                    }
                    ctx.dbuser.selectedSection = selectedSection
                    ctx.dbuser.state = ''
                    await ctx.dbuser.save()
                    const sections2 = await getSectionsByUser(ctx.dbuser.id)
                    let keyboard2 = sectionsKeyboard(sections2, ctx)
                    await ctx.editMessageReplyMarkup({ reply_markup: keyboard2.reply_markup })
                    break
                case 'share_':
                    const shareSection = await findSection(id)
                    if (shareSection.authorId !== ctx.dbuser.id) {
                        return ctx.reply(ctx.i18n.t('something_wrong'))
                    }
                    const shareLink = `https://t.me/${ctx.me.username}?start=t_${id}_${ctx.dbuser.id}`
                    return ctx.reply(ctx.i18n.t('topic_link', { topic: shareSection.title, link: shareLink }), { link_preview_options: { is_disabled: true } })
                case 'pub_':
                    const pubSection = await findSection(id)
                    if (pubSection.authorId !== ctx.dbuser.id) {
                        return ctx.reply(ctx.i18n.t('something_wrong'))
                    }
                    pubSection.isPublic = !pubSection.isPublic
                    await pubSection.save()
                    return ctx.reply(pubSection.isPublic ? ctx.i18n.t('topic_now_public') : ctx.i18n.t('topic_now_private'))
                case 'join_':
                    const joinSection = await findSection(id)
                    if (!joinSection || !joinSection.isPublic) {
                        return ctx.reply(ctx.i18n.t('something_wrong'))
                    }
                    await import('@/models/TopicMembership').then(async ({ upsertTopicMembership }) => {
                        await upsertTopicMembership(new mongoose.Types.ObjectId(id), ctx.dbuser.id, 0)
                    })
                    ctx.dbuser.activeTopicSection = joinSection
                    await ctx.dbuser.save()
                    return ctx.reply(ctx.i18n.t('topic_invite_joined', { topic: joinSection.title }))

                case questionPrefix:
                    if (id === 'new') {
                        ctx.dbuser.selectedQuestion = null
                        ctx.dbuser.state = waitQuestionState
                        await ctx.dbuser.save()
                        await ctx.reply(ctx.i18n.t('create_question_wait'), { parse_mode: "MarkdownV2" })
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
                        await ctx.reply(ctx.i18n.t('update_question_wait', { oldQuestion: quiz.question }),
                            { parse_mode: "MarkdownV2" })
                        return next()
                    }
                    let kb2 = answersKeyboard(quiz, ctx)
                    await ctx.reply(ctx.i18n.t('question', { question: quiz.question }), { parse_mode: "MarkdownV2", reply_markup: kb2.reply_markup })
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
                        await ctx.reply(ctx.i18n.t('create_answer_wait'), cancelKeyboard(ctx, CancelCallback.cancel_question))
                    } else {
                        await ctx.reply(ctx.i18n.t('update_answer_wait', { oldAnswer: answer }),
                            { parse_mode: "MarkdownV2", reply_markup: cancelKeyboard(ctx, CancelCallback.cancel_question).reply_markup })
                    }
                    break
                default:
                    return next()
            }
    }
}

export async function waitMiddleware(ctx: MyContext, next: NextFunction) {
    if (!ctx.message || !ctx.dbuser.state) {
        return next()
    }
    let text = (ctx.message as any).text
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
                await ctx.reply(ctx.i18n.t('create_question_result'), kb)
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
            await ctx.reply(ctx.i18n.t('update_question_result', { oldQuestion: old, newQuestion: newQuiz.question }),
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
                await ctx.reply(ctx.i18n.t('create_answer_result', { newAnswer: newAnswer }),
                    { parse_mode: "MarkdownV2", reply_markup: keyboard.reply_markup })
            } else {
                await ctx.reply(ctx.i18n.t('update_answer_result', { oldAnswer: oldAnswer, newAnswer: newAnswer }),
                    { parse_mode: "MarkdownV2", reply_markup: keyboard.reply_markup })
            }
            break
        default:
            return next()
    }
}

export async function updateSectionTitleCallback(ctx: MyContext, next: NextFunction) {
    if (!ctx.callbackQuery) return next()
    const data = 'data' in ctx.callbackQuery ? ctx.callbackQuery.data : undefined
    if (!data) return next()

    if (data === 'create_section_title') {
        ctx.dbuser.state = waitSectionState
        await ctx.dbuser.save()
        let keyboard = cancelKeyboard(ctx, CancelCallback.cancel_section)
        return await ctx.editMessageText(ctx.i18n.t('create_section_title'), { reply_markup: keyboard.reply_markup })
    }

    // Dynamic prefix handlers not caught by createCallback's switch
    const prefixes = ['share_', 'pub_', 'join_']
    for (const p of prefixes) {
        if (data.startsWith(p)) {
            return next() // handled inside createCallback
        }
    }

    return next()
}

function cancelKeyboard(ctx: MyContext, data: CancelCallback = CancelCallback.cancel) {
    return { reply_markup: new InlineKeyboard().text(ctx.i18n.t('cancel_button'), data) }
}

export function sectionsKeyboard(sections: DocumentType<Section[]>, ctx: MyContext) {
    const kb = new InlineKeyboard()
    kb.text('🔧 ' + ctx.i18n.t('create_button'), 'create_button').row()
    ;(sections as any as DocumentType<Section>[]).forEach((s: DocumentType<Section>) => {
        var title = s.title
        if (ctx.dbuser.selectedSection && ctx.dbuser.selectedSection.equals(s.id.toString())) {
            title = '✅' + title
        }
        kb.text(title, sectionPrefix + s.id).row()
    })
    return { reply_markup: kb }
}

export function questionsKeyboard(quizzes: DocumentType<Quiz[]>, section: DocumentType<Section>, ctx: MyContext) {
    const pubLabel = section.isPublic
        ? '🔒 ' + ctx.i18n.t('make_private')
        : '🌐 ' + ctx.i18n.t('make_public')
    const kb = new InlineKeyboard()
        .text('◀️ ' + ctx.i18n.t('back'), 'back_sections')
        .text('✍️ ' + ctx.i18n.t('update_section_title'), 'create_section_title').row()
        .text('👊 ' + ctx.i18n.t('create_question'), questionPrefix + 'new')
        .text('🔗 ' + ctx.i18n.t('share_topic'), 'share_' + section._id).row()
        .text(pubLabel, 'pub_' + section._id).row()
    ;(quizzes as any as DocumentType<Quiz>[]).forEach((q: DocumentType<Quiz>) => {
        kb.text(q.question, questionPrefix + q._id).row()
    })
    return { reply_markup: kb }
}

function answersKeyboard(quiz: Quiz, ctx: MyContext) {
    const kb = new InlineKeyboard()
        .text('◀️ ' + ctx.i18n.t('back'), 'back_questions')
        .text('✍️ ' + ctx.i18n.t('update_question_title'), questionPrefix + quiz._id + delimiter + 'update').row()
    quiz.answers.forEach((a: string, idx: number) => {
        kb.text((idx === 0 ? '(✅) ' : '') + a, answerPrefix + quiz._id + delimiter + idx).row()
    })
    if (quiz.answers.length < 10) {
        kb.text(ctx.i18n.t('create_answer'), answerPrefix + quiz._id + delimiter + quiz.answers.length).row()
    }
    return { reply_markup: kb }
}
