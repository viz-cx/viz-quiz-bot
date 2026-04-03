# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
yarn develop          # Dev mode: concurrent tsc -w + nodemon dist/app.js
yarn build-ts         # Compile TypeScript to dist/
yarn test             # Run all tests (jest --runInBand)
yarn test:watch       # Watch mode
yarn test:coverage    # Coverage report
yarn test -- --testPathPattern="checkAnswer"  # Run a single test file
```

Tests use `mongodb-memory-server` — no external MongoDB needed. Tests run serially (`--runInBand`) because they share a single in-memory DB instance.

## Architecture

**Telegram quiz bot** built with **grammY** + **Mongoose/Typegoose** + **VIZ blockchain**. Users answer Telegram native polls (quiz type) to earn points, create quiz sections, invite others to topics, and withdraw earnings as VIZ blockchain tokens.

### Module alias

`@/` maps to `dist/` at runtime (via `module-alias`) and `src/` in tests (via jest `moduleNameMapper`). Always use `@/` imports for models, helpers, types.

### Context

Every handler receives `MyContext` (`src/types/context.ts`) which extends grammY's `Context` with:
- `ctx.dbuser` — Typegoose `DocumentType<User>` (attached by `attachUser` middleware)
- `ctx.i18n` — i18n instance with `t(key, params?)` and `locale()` methods
- `ctx.viz` — VIZ blockchain client

### Middleware chain (order matters)

Defined in `src/app.ts`. Middlewares run sequentially — some intercept updates and skip `next()`:
1. `ignoreOldMessageUpdates` — drops messages older than 5 min
2. `attachUser` — loads/creates user from DB, attaches `ctx.dbuser` and `ctx.viz`
3. `i18nMiddleware` + `attachI18N` — creates i18n instance, sets locale from user's language
4. `cancelCallback` — handles "cancel" callback buttons
5. `checkAnswer` — intercepts `poll` updates, validates quiz answers, distributes rewards
6. `nextQuestionCallback` — handles "next_quiz" callback
7. `proposeQuiz` — accepts forwarded Telegram polls as new quiz submissions
8. `resetCallback`, `createCallback`, `waitMiddleware`, `updateSectionTitleCallback` — handler-specific middleware

### Reward distribution

When a user answers correctly (`checkAnswer` middleware):
- Base reward = `100 + (100/10 * multiplier)`, scaled by difficulty (0.5x–2x)
- Without topic inviter: 50% solver / 50% author
- With topic inviter: 25% solver / 50% author / 25% inviter
- Correct answer increments multiplier streak; wrong answer resets to 0

### Menu routing

Main keyboard uses emoji-prefixed buttons. `bot.hears(RegExp)` in `app.ts` matches the emoji prefix to route to the correct handler. The `Emoji` enum in `src/helpers/keyboard.ts` is the source of truth.

### i18n

Custom implementation in `src/helpers/i18n.ts`. Translations are YAML files in `locales/`. Supports `${key}` interpolation and ternary expressions `${key ? 'yes' : 'no'}`. The standalone `t(language, key, params)` function is used outside middleware context (notifications, etc.).

### Test infrastructure

- `src/__tests__/setup/db.ts` — in-memory MongoDB lifecycle (connect/disconnect/clear)
- `src/__tests__/setup/contextFactory.ts` — `makeCtx()` builds a mock grammY context with jest fns
- `src/__tests__/mocks/models.ts` — replaces `@/models` index to avoid the real `mongoose.connect` side-effect
- Pattern: `beforeAll(connect)`, `afterAll(disconnect)`, `afterEach(clear)`

### Recurring background tasks

Started in `bot.start()` callback, not as middleware:
- `sendNotifications.ts` — every 72h, notify users with unanswered quizzes
- `unstake.ts` — daily, unstake excess VIZ shares
- `selfAward.ts` — random 5–50h interval, self-vote to regenerate energy

## Environment variables

See `.env.sample`: `TOKEN` (Telegram), `MONGO` (MongoDB URI), `ADMIN_TELEGRAM_ID`, `ACCOUNT`/`WIF`/`BALANCE` (VIZ blockchain).
