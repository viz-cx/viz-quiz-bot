/**
 * Factory for building minimal grammY Context mocks.
 * Tests import makeCtx() and customise the returned object as needed.
 */
import { DocumentType } from '@typegoose/typegoose/lib/types'
import { User } from '@/models/User'

// ---------------------------------------------------------------------------
// Minimal i18n mock — returns the translation key so tests can assert on it
// ---------------------------------------------------------------------------
export function makeI18n() {
    return {
        t: jest.fn((key: string, _params?: Record<string, unknown>) => key),
        locale: jest.fn(() => 'ru'),
    }
}

// ---------------------------------------------------------------------------
// Minimal Telegram API surface mock
// ---------------------------------------------------------------------------
export function makeApi() {
    return {
        sendMessage: jest.fn().mockResolvedValue(undefined),
        sendPoll: jest.fn().mockResolvedValue({ message_id: 42, poll: { id: 'poll-123' } }),
        stopPoll: jest.fn().mockResolvedValue(undefined),
        deleteMessage: jest.fn().mockResolvedValue(undefined),
        pinChatMessage: jest.fn().mockResolvedValue(undefined),
    }
}

// ---------------------------------------------------------------------------
// Main context factory
// ---------------------------------------------------------------------------
export interface CtxOverrides {
    dbuser?: Partial<DocumentType<User>>
    poll?: Partial<{
        id: string
        type: string
        question: string
        options: Array<{ text: string; voter_count: number }>
        correct_option_id: number
        is_closed: boolean
    }>
    match?: string
    callbackQuery?: { data: string; message?: { message_id: number } }
}

export function makeCtx(overrides: CtxOverrides = {}) {
    const i18n = makeI18n()
    const api = makeApi()

    // Default user — callers may spread their own DocumentType<User>
    const defaultUser = {
        id: 1001,
        balance: 0,
        multiplier: 0,
        difficulty: 1, // Difficulty.Normal
        answered: [] as any[],
        quizId: null as any,
        pollId: null as any,
        quizMessageId: null as any,
        activeTopicSection: undefined as any,
        selectedSection: undefined as any,
        state: '',
        save: jest.fn().mockResolvedValue(undefined),
    }

    const dbuser = { ...defaultUser, ...(overrides.dbuser ?? {}) }

    const ctx: any = {
        dbuser,
        i18n,
        api,
        me: { username: 'TestQuizBot' },
        // Helpers used by handlers
        reply: jest.fn().mockResolvedValue(undefined),
        replyWithQuiz: jest.fn().mockResolvedValue({ message_id: 42, poll: { id: 'poll-123' } }),
        editMessageText: jest.fn().mockResolvedValue(undefined),
        editMessageReplyMarkup: jest.fn().mockResolvedValue(undefined),
        deleteMessage: jest.fn().mockResolvedValue(undefined),
        answerCallbackQuery: jest.fn().mockResolvedValue(undefined),
        forwardMessage: jest.fn().mockResolvedValue(undefined),
        // Poll context (set when a poll update arrives)
        poll: overrides.poll ?? null,
        // match (set by grammY for /start deep-links)
        match: overrides.match ?? '',
        // callbackQuery (set for button clicks)
        callbackQuery: overrides.callbackQuery ?? null,
        // chat info
        chat: { id: 1001 },
        from: { id: 1001 },
    }

    return ctx
}
