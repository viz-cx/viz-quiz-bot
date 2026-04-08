import { parseTextQuiz } from '@/helpers/parseTextQuiz'

describe('parseTextQuiz', () => {
    it('parses single-correct quiz (no markers, first answer correct)', () => {
        const text = `What is 2+2?\n4\n5\n6`
        const result = parseTextQuiz(text)
        expect(result).not.toBeNull()
        expect(result.question).toBe('What is 2+2?')
        expect(result.answers).toEqual(['4', '5', '6'])
        expect(result.correctAnswerIndices).toEqual([0])
        expect(result.description).toBeUndefined()
    })

    it('parses multi-correct quiz with + markers', () => {
        const text = `Which are prime?\n+2\n+3\n4\n+5\n6`
        const result = parseTextQuiz(text)
        expect(result).not.toBeNull()
        expect(result.question).toBe('Which are prime?')
        expect(result.answers).toEqual(['2', '3', '4', '5', '6'])
        expect(result.correctAnswerIndices).toEqual([0, 1, 3])
    })

    it('detects description when line 2 is 30+ chars without + prefix', () => {
        const text = `Capital of France?\nA beautiful European city known for art\nParis\nLondon\nBerlin`
        const result = parseTextQuiz(text)
        expect(result).not.toBeNull()
        expect(result.question).toBe('Capital of France?')
        expect(result.description).toBe('A beautiful European city known for art')
        expect(result.answers).toEqual(['Paris', 'London', 'Berlin'])
        expect(result.correctAnswerIndices).toEqual([0])
    })

    it('does not treat short line 2 as description', () => {
        const text = `Question?\nAnswer1\nAnswer2\nAnswer3`
        const result = parseTextQuiz(text)
        expect(result).not.toBeNull()
        expect(result.description).toBeUndefined()
        expect(result.answers).toEqual(['Answer1', 'Answer2', 'Answer3'])
    })

    it('does not treat line 2 starting with + as description even if 30+ chars', () => {
        const text = `Question?\n+This is a very long correct answer text here\nWrong answer`
        const result = parseTextQuiz(text)
        expect(result).not.toBeNull()
        expect(result.description).toBeUndefined()
        expect(result.answers).toEqual(['This is a very long correct answer text here', 'Wrong answer'])
        expect(result.correctAnswerIndices).toEqual([0])
    })

    it('handles description + markers combined', () => {
        const text = `Which planets are rocky?\nSelect all terrestrial planets from the list below\n+Mercury\n+Venus\nJupiter\n+Earth`
        const result = parseTextQuiz(text)
        expect(result).not.toBeNull()
        expect(result.description).toBe('Select all terrestrial planets from the list below')
        expect(result.answers).toEqual(['Mercury', 'Venus', 'Jupiter', 'Earth'])
        expect(result.correctAnswerIndices).toEqual([0, 1, 3])
    })

    it('returns null for less than 3 lines (question + min 2 answers)', () => {
        expect(parseTextQuiz('Question?\nAnswer1')).toBeNull()
    })

    it('returns null for 1 answer after description extraction', () => {
        const text = `Question?\nThis is a long description over thirty characters\nSingleAnswer`
        expect(parseTextQuiz(text)).toBeNull()
    })

    it('returns null for more than 10 answers', () => {
        const lines = ['Question?', ...Array.from({ length: 11 }, (_, i) => `Answer${i + 1}`)]
        expect(parseTextQuiz(lines.join('\n'))).toBeNull()
    })

    it('handles exactly 2 answers (minimum)', () => {
        const result = parseTextQuiz('Q?\nA\nB')
        expect(result).not.toBeNull()
        expect(result.answers).toEqual(['A', 'B'])
    })

    it('handles exactly 10 answers (maximum)', () => {
        const lines = ['Q?', ...Array.from({ length: 10 }, (_, i) => `A${i + 1}`)]
        const result = parseTextQuiz(lines.join('\n'))
        expect(result).not.toBeNull()
        expect(result.answers).toHaveLength(10)
    })

    it('strips whitespace from lines', () => {
        const text = `  Question?  \n  +Right  \n  Wrong  `
        const result = parseTextQuiz(text)
        expect(result).not.toBeNull()
        expect(result.question).toBe('Question?')
        expect(result.answers).toEqual(['Right', 'Wrong'])
    })

    it('ignores empty lines', () => {
        const text = `Question?\n\n+Right\n\nWrong\n`
        const result = parseTextQuiz(text)
        expect(result).not.toBeNull()
        expect(result.answers).toEqual(['Right', 'Wrong'])
    })

    it('single + marker marks only that answer correct', () => {
        const text = `Q?\nWrong1\n+Right\nWrong2`
        const result = parseTextQuiz(text)
        expect(result.answers).toEqual(['Wrong1', 'Right', 'Wrong2'])
        expect(result.correctAnswerIndices).toEqual([1])
    })
})
