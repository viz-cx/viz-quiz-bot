import { Telegraf, Context } from "telegraf"

export function setupStart(bot: Telegraf<Context>) {
    bot.command(['start'], ctx => {
        sendQuiz(ctx)
    })
}

function sendQuiz(ctx: Context) {
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
                return record.get('Question') != undefined
            })
            let randomRecord = filteredRecords[Math.floor(Math.random() * filteredRecords.length)]
            let question = randomRecord.get('Question')
            let answers = randomRecord.get('Answers').split(/\n/).filter(n => n)
            let correctValue = answers[0]
            let shuffledAnswers = shuffle(answers)
            let correctValueID = shuffledAnswers.indexOf(correctValue)
            // let secondsToAnswer = 10
            ctx.replyWithQuiz(question, shuffledAnswers, {
                is_anonymous: false,
                allows_multiple_answers: false,
                correct_option_id: correctValueID,
                is_closed: false,
                // open_period: secondsToAnswer
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
