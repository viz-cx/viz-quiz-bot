import { Message } from 'telegraf/typings/core/types/typegram'
import { bot } from './helpers/bot'
import { i18n } from './helpers/i18n'
import { getQuizCountAfterDate, getUsersNotifiedBefore } from './models'

export function startNotifications() {
    // const hours = 20
    // setTimeout(() => {
    //     makeNotifications()
    //     startNotifications()
    // }, 1000 * 60 * 60 * hours)
    makeNotifications()
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
            while (users.length > 0) {
                const messages: Promise<Message>[] = users.splice(0, 29)
                    .map(async user => {
                        let unansweredCount = await getQuizCountAfterDate(new Date(0))//user.updatedAt)
                        if (unansweredCount > notifyWhenMoreThan) {
                            user.notifiedAt = Date()
                            await user.save()
                            return await bot.telegram.sendMessage(
                                user.id, i18n.t(user.language, 'notification', { count: unansweredCount }))
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
