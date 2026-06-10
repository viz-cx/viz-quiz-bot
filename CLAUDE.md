# viz-quiz-bot
Telegram quiz bot. grammY + Mongoose/Typegoose + VIZ blockchain. Users answer polls to earn points, create quiz sections, withdraw earnings as VIZ tokens.

## Commands
```bash
yarn develop       # concurrent tsc -w + nodemon dist/app.js
yarn build-ts      # tsc → dist/
yarn test          # jest --runInBand (serial, shared in-memory DB)
yarn test -- --testPathPattern="checkAnswer"
```
Tests use `mongodb-memory-server` — no external MongoDB needed.

## Critical Gotchas
- **`@/` alias**: maps to `dist/` at runtime (module-alias), `src/` in tests (jest moduleNameMapper). Always use `@/` for models/helpers/types.
- **Background tasks** (`sendNotifications`, `unstake`, `selfAward`) are started in `bot.start()` callback — not as middleware.

## Context (`MyContext`)
- `ctx.dbuser` — Typegoose `DocumentType<User>` (attached by `attachUser`)
- `ctx.i18n` — `t(key, params?)` + `locale()`
- `ctx.viz` — VIZ blockchain client

## Middleware chain (order matters)
`ignoreOldMessageUpdates → attachUser → i18nMiddleware+attachI18N → cancelCallback → checkAnswer → nextQuestionCallback → proposeQuiz → resetCallback → createCallback → waitMiddleware → updateSectionTitleCallback`

## Reward distribution (`checkAnswer`)
Base = `100 + (100/10 × multiplier)` × difficulty (0.5×–2×)
- No inviter: 60% solver / 40% author
- With inviter: 40% solver / 40% author / 20% inviter
- Correct → increment multiplier streak; wrong → reset to 0

## Menu routing
`bot.hears(RegExp)` matches emoji prefix → handler. `Emoji` enum in `src/helpers/keyboard.ts` is source of truth.

## i18n
YAML files in `locales/`. `${key}` interpolation + ternary `${key ? 'yes' : 'no'}`. Outside middleware: `t(language, key, params)`.

## Env
`.env.sample`: `TOKEN`, `MONGO`, `ADMIN_TELEGRAM_ID`, `ACCOUNT`/`WIF`/`BALANCE` (VIZ blockchain).
