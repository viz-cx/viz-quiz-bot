# Poll Rework & Multi-Correct Quiz Support

**Date:** 2026-04-04
**Status:** Approved
**Trigger:** Telegram Bot API 9.6 (April 3, 2026) replaced `correct_option_id` with `correct_option_ids`, breaking the bot. This is also an opportunity to add text-based quiz creation and improve reward distribution.

---

## 1. Dependency Update

Update `grammy` from `1.41.1` to `1.42.0` to get Bot API 9.6 type support (`correct_option_ids`, `shuffle_options`, `description`, `hide_results_until_closes`, etc.).

---

## 2. Quiz Model Changes

**File:** `src/models/Quiz.ts`

Add a new field to the Quiz class:

```
correctAnswerIndices: number[]  // default: [0]
```

- Replaces the implicit "first answer is always correct" convention
- Existing quizzes with a single correct answer at index 0 work unchanged (default `[0]`)
- Multi-correct quizzes store multiple indices (e.g., `[0, 1, 3]`)
- The `answers` array continues to store all answer texts in their original order

No changes to Section or TopicMembership models.

---

## 3. Text-Based Quiz Creation

**File:** `src/handlers/sendSelect.ts` (extend existing `wait_question` state)

### Accepted Formats

**Format 1 — No markers (single correct, first answer is correct):**

```
What is the capital of France?
A beautiful European city known for the Eiffel Tower
Paris
London
Berlin
Madrid
```

**Format 2 — `+` prefix markers (one or multiple correct):**

```
Which are prime numbers?
Select all prime numbers from the list
+2
+3
4
+5
6
```

### Parsing Rules

1. Line 1: question title (required, stripped of whitespace)
2. Line 2: description if it has 30+ characters AND does not start with `+`; otherwise treated as an answer
3. Remaining lines: answers. Lines starting with `+` are correct answers (prefix stripped before storage)
4. If no `+` markers found anywhere: first answer is correct (`correctAnswerIndices: [0]`)
5. If `+` markers found: indices of `+`-prefixed lines become `correctAnswerIndices`
6. Validation: minimum 2 answers, maximum 10 (Telegram limit). Title required. At least 1 correct answer.

### Integration

- User must have `selectedSection` set before creating a text quiz (same gate as forwarded polls)
- The `wait_question` state handler in sendSelect is updated to use this parser
- On success: creates Quiz document, replies with confirmation, rewards author 500 points

---

## 4. Forwarded Poll Import

**File:** `src/middlewares/proposeQuiz.ts`

- Continue accepting only quiz-type polls (not regular polls)
- Read `correct_option_ids` (array) from forwarded poll instead of `correct_option_id`
- Map correct option indices to `correctAnswerIndices` on the Quiz document
- Reorder answers so correct answers come first (preserving relative order), update `correctAnswerIndices` accordingly to always reflect final storage positions

---

## 5. Sending Quizzes

**File:** `src/handlers/sendQuiz.ts`

### Changes

- Remove manual shuffle logic (the `shuffleAnswers` helper)
- Pass `shuffle_options: true` to let Telegram handle randomization
- Pass `correct_option_ids: quiz.correctAnswerIndices` (array) instead of `correct_option_id`
- If quiz has `description`, pass it as `description` parameter
- Pass `hide_results_until_closes: true` for competitive feel
- For multi-correct quizzes: `allows_multiple_answers: true`
- For single-correct quizzes: `allows_multiple_answers: false` (current behavior)
- Open period values by difficulty remain unchanged (Easy=600s, Normal=60s, Hard=20s, Nightmare=10s)

### Answer Identification

Since `shuffle_options: true` means the server reorders options, we no longer track which specific option the user picked by positional index. Instead, the `checkAnswer` middleware uses `ctx.poll.correct_option_ids` (provided by Telegram in the poll update) to determine correctness. The bot compares which options received votes against `correct_option_ids` — both are in Telegram's shuffled coordinate space, so they match directly. No local persistent_id-to-index mapping is needed.

---

## 6. Answer Checking

**File:** `src/middlewares/checkAnswer.ts`

### Multi-Correct Scoring

```
correctPicked  = number of correct options the user selected
totalCorrect   = total correct options in the quiz
wrongPicked    = number of wrong options the user selected
totalWrong     = total wrong options in the quiz

accuracy = (correctPicked / totalCorrect) - (wrongPicked / totalWrong)
accuracy = max(0, accuracy)   // clamp, never negative

reward = baseReward * accuracy
```

- **Single-correct quiz**: accuracy is 1.0 (right) or 0.0 (wrong) — identical to current behavior
- **Multi-correct quiz**: partial credit with penalty for wrong picks
- **Base reward formula unchanged**: `100 + (100 / 10 * multiplier)`, scaled by difficulty

### Multiplier Streak

- Increases by 1 only if `accuracy === 1.0` (perfect answer)
- Resets to 0 if `accuracy < 1.0` (any mistake)

### API Migration

- Read `ctx.poll.correct_option_ids` (array) instead of `correct_option_id`
- Use PollOption `persistent_id` to identify which answers were selected when shuffle is on
- Handle `allows_multiple_answers: true` polls — count all selected options

---

## 7. Reward Distribution

**File:** `src/middlewares/checkAnswer.ts`

### New Split Ratios

| Scenario     | Solver | Author | Inviter |
|------------- |--------|--------|---------|
| No inviter   | 60%    | 40%    | --      |
| With inviter | 40%    | 40%    | 20%     |

Changed from previous 50/50 and 25/50/25. Solver share increased to better incentivize answering.

### Author Creation Reward

Stays at 500 points per quiz created (both text and forwarded).

---

## 8. Test Coverage

All tests use existing infrastructure: `mongodb-memory-server`, `makeCtx()` factory, `@/models` mock.

### 8.1 Text Quiz Parsing Tests

**File:** `src/__tests__/handlers/parseTextQuiz.test.ts`

- Single correct (no markers): title, description, answers, `correctAnswerIndices: [0]`
- Multi-correct (`+` markers): correct indices identified and stored
- Description detection: 30+ char line 2 without `+` prefix → description field set
- No description: short line 2 or `+`-prefixed → treated as answer
- Edge cases: exactly 2 answers (min), exactly 10 answers (max)
- Validation errors: missing title, 0 or 1 answer, 11+ answers, no correct answer with `+` markers

### 8.2 checkAnswer — Multi-Correct

**File:** `src/__tests__/middlewares/checkAnswer.test.ts` (extend existing)

- All correct selected, no wrong → full reward, multiplier +1
- Partial correct, no wrong → proportional reward, multiplier reset
- Partial correct + some wrong → reduced reward, multiplier reset
- All wrong → zero reward, multiplier reset
- Single-correct backward compat: same outcomes as before

### 8.3 Reward Calculation

**File:** `src/__tests__/middlewares/checkAnswer.test.ts` (extend existing)

- 60/40 split without inviter verified
- 40/40/20 split with inviter verified
- Each difficulty multiplier (0.5x, 1x, 1.5x, 2x) applied correctly
- Multiplier streak: consecutive perfect answers accumulate, one imperfect resets

### 8.4 proposeQuiz — Multi-Correct Import

**File:** `src/__tests__/middlewares/proposeQuiz.test.ts` (new)

- Forwarded quiz poll with single `correct_option_ids` → `correctAnswerIndices` stored
- Forwarded quiz poll with multiple `correct_option_ids` → all indices stored
- Non-quiz poll rejected
- Duplicate poll (same `pollId`) rejected

### 8.5 sendQuiz — API Parameters

**File:** `src/__tests__/handlers/sendQuiz.test.ts` (new)

- `correct_option_ids` (array) passed to Telegram API
- `shuffle_options: true` always set
- `description` passed when quiz has one, omitted when empty
- `hide_results_until_closes: true` always set
- `allows_multiple_answers: true` for multi-correct quizzes, `false` for single

---

## 9. Implementation Order

1. Update `grammy` to `1.42.0`
2. Add `correctAnswerIndices` field to Quiz model
3. Migrate `checkAnswer` to use `correct_option_ids` and new scoring formula
4. Update `sendQuiz` to use new API parameters
5. Update `proposeQuiz` to read `correct_option_ids`
6. Extend text quiz parser in `sendSelect` for `+` marker format
7. Update reward split ratios in `checkAnswer`
8. Add/update all tests
9. Run full test suite, fix any regressions

---

## 10. Files Modified

| File | Change |
|------|--------|
| `package.json` | grammy version bump |
| `src/models/Quiz.ts` | Add `correctAnswerIndices` field |
| `src/middlewares/checkAnswer.ts` | Multi-correct scoring, new reward splits, `correct_option_ids` API |
| `src/handlers/sendQuiz.ts` | Remove manual shuffle, new API params |
| `src/middlewares/proposeQuiz.ts` | Read `correct_option_ids` from forwarded polls |
| `src/handlers/sendSelect.ts` | Extended text quiz parser with `+` markers and description |
| `src/__tests__/handlers/parseTextQuiz.test.ts` | New test file |
| `src/__tests__/middlewares/proposeQuiz.test.ts` | New test file |
| `src/__tests__/handlers/sendQuiz.test.ts` | New test file |
| `src/__tests__/middlewares/checkAnswer.test.ts` | Extended with multi-correct and reward tests |
| `src/__tests__/setup/contextFactory.ts` | Extend `makeCtx` to support multi-correct poll mocks |
