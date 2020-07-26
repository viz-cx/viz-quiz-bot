import { Telegraf, Context } from "telegraf"
import { nextQuestionKeyboard } from "../middlewares/checkAnswer"

export function setupStart(bot: Telegraf<Context>) {
    bot.command(['start'], ctx => {
        sendQuiz(ctx)
    })
}

export function sendQuiz(ctx: Context) {
    let Airtable = require('airtable')
    Airtable.configure({
        endpointUrl: 'https://api.airtable.com',
        apiKey: process.env.AIRTABLE_API_KEY
    })
    let base = Airtable.base(process.env.AIRTABLE_BASE)
    base('RU').select({
        maxRecords: 1200,
        view: 'Grid view'
    }).firstPage(function (err, records) {
        if (err) {
            console.error(err)
            return
        }
        let filteredRecords = records.filter(function (record) {
            let verified = record.get('Verified')
            if (verified != true) {
                return false
            }
            let q = record.get('Question')
            if (q == undefined) {
                return false
            }
            if (q.length < 1 || q.length > 255) {
                console.log('Вопрос ', q, ' не удовлетворяет условиям длины')
                return false
            }
            let e = record.get('Explanation')
            if (e.length > 200) {
                console.log('Ответ к вопросу', q, 'слишком длинный')
                return false
            }
            return true
        })
        let answeredRecords = ctx.dbuser.answeredRecords
        let unansweredRecords = filteredRecords
            .filter((record) => answeredRecords.indexOf(record.id) === -1)
        if (unansweredRecords.length === 0) {
            let replyMsg = ctx.reply("Закончились неотвеченные вопросы, попробуйте завтра", {reply_markup: nextQuestionKeyboard})
            replyMsg.then(msg => {
                let user = ctx.dbuser
                if (user.quizMessageId) {
                    ctx.deleteMessage(user.quizMessageId)
                }
                user.quizMessageId = msg.message_id
                user.save()
            })
            return
        }
        let randomRecord = unansweredRecords[Math.floor(Math.random() * unansweredRecords.length)]
        let question = randomRecord.get('Question')
        let answers = randomRecord.get('Answers').split(/\n/).filter(n => n)
        let correctValue = answers[0]
        let shuffledAnswers = shuffle(answers)
        let correctValueID = shuffledAnswers.indexOf(correctValue)
        let explanation = randomRecord.get('Explanation')
        // let secondsToAnswer = 10
        let quizMsg = ctx.replyWithQuiz(question, shuffledAnswers, {
            is_anonymous: true,
            allows_multiple_answers: false,
            correct_option_id: correctValueID,
            is_closed: false,
            explanation: explanation,
            // open_period: secondsToAnswer
        })
        quizMsg.then(msg => {
            let user = ctx.dbuser
            if (user.quizMessageId) {
                ctx.deleteMessage(user.quizMessageId)
            }
            user.answeredRecords.push(randomRecord.id)
            user.quizId = msg.poll.id
            user.quizMessageId = msg.message_id
            user.save()
            // setTimeout(function () { closePoll(ctx, msg.message_id) }, secondsToAnswer * 1000);
        })
    })
}

function shuffle(array) {
    var currentIndex = array.length, temporaryValue, randomIndex
    while (0 !== currentIndex) {
        randomIndex = Math.floor(Math.random() * currentIndex)
        currentIndex -= 1
        temporaryValue = array[currentIndex]
        array[currentIndex] = array[randomIndex]
        array[randomIndex] = temporaryValue
    }
    return array
}
