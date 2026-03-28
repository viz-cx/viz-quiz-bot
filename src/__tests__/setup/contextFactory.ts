/**
 * Factory for building minimal Telegraf Context mocks.
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
export function makeTelegram() {
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
    startPayload?: string
    callbackQuery?: { data: string; message?: { message_id: number } }
}

export function makeCtx(overrides: CtxOverrides = {}) {
    const i18n = makeI18n()
    const telegram = makeTelegram()

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
        telegram,
        botInfo: { username: 'TestQuizBot' },
        // Helpers used by handlers
        reply: jest.fn().mockResolvedValue(undefined),
        replyWithHTML: jest.fn().mockResolvedValue(undefined),
        sendMessage: jest.fn().mockResolvedValue(undefined),
        deleteMessage: jest.fn().mockResolvedValue(undefined),
        answerCbQuery: jest.fn().mockResolvedValue(undefined),
        // Poll context (set when a poll update arrives)
        poll: overrides.poll ?? null,
        // startPayload (set by Telegraf for /start deep-links)
        startPayload: overrides.startPayload ?? '',
        // callbackQuery (set for button clicks)
        callbackQuery: overrides.callbackQuery ?? null,
    }

    return ctx
}
