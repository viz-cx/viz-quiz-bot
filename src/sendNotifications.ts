import { Message } from 'telegraf/typings/core/types/typegram'
import { mainKeyboard } from './helpers/keyboard'
import { bot } from './helpers/bot'
import { i18n } from './helpers/i18n'
import { getQuizCountAfterDate, getUsersNotifiedBefore, updateNotifiedDate } from './models'

export async function startNotifications() {
    const hours = 72
    setTimeout(() => {
        makeNotifications()
        startNotifications()
    }, 1000 * 60 * 60 * hours)
}

async function makeNotifications() {
    const days = 7
    const date = new Date(new Date().getTime() - (days * 24 * 60 * 60 * 1000))
    const notifyWhenMoreThan = 10
    await getUsersNotifiedBefore(date)
        .then(async users => {
            var users = users
            console.log('Start sending to', users.length, 'users')
            var successCounter = 0
            let allQuizzesCount = await getQuizCountAfterDate(new Date(0))
            while (users.length > 0) {
                const messages: Promise<Message>[] = users.splice(0, 29)
                    .map(async user => {
                        let unansweredCount = await getQuizCountAfterDate(user.updatedAt)
                        if (unansweredCount >= notifyWhenMoreThan && unansweredCount < allQuizzesCount - 1) {
                            updateNotifiedDate(user.id)
                            return await bot.telegram.sendMessage(
                                user.id, i18n.t(user.language, 'notification', { count: unansweredCount }), mainKeyboard(user.language))
                        } else {
                            return await Promise.reject('No need to notify')
                        }
                    })
                await Promise.allSettled(messages)
                    .then(result => {
                        const sendedMessagesCount = result.map(msg => msg.status).filter(status => status == 'fulfilled').length
                        console.log('Successfully sended to', sendedMessagesCount, 'users. Now waiting...')
                        successCounter += sendedMessagesCount
                    })
                await sleep(3000)
            }
            console.log('Successfully sended to ' + successCounter + ' users!')
        })
}

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms))
}
