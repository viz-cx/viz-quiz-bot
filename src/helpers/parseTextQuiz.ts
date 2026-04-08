export interface ParsedQuiz {
    question: string
    description?: string
    answers: string[]
    correctAnswerIndices: number[]
}

export function parseTextQuiz(text: string): ParsedQuiz {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0)

    if (lines.length < 3) {
        return null
    }

    const question = lines[0]
    let remaining = lines.slice(1)
    let description: string | undefined

    // Detect description: line 2 is 30+ chars and doesn't start with +
    if (remaining.length > 0 && remaining[0].length >= 30 && !remaining[0].startsWith('+')) {
        description = remaining[0]
        remaining = remaining.slice(1)
    }

    if (remaining.length < 2 || remaining.length > 10) {
        return null
    }

    // Check if any line has + prefix
    const hasMarkers = remaining.some(l => l.startsWith('+'))

    const answers: string[] = []
    const correctAnswerIndices: number[] = []

    for (let i = 0; i < remaining.length; i++) {
        const line = remaining[i]
        if (hasMarkers && line.startsWith('+')) {
            correctAnswerIndices.push(i)
            answers.push(line.slice(1).trim())
        } else {
            answers.push(line)
        }
    }

    // No markers: first answer is correct
    if (!hasMarkers) {
        correctAnswerIndices.push(0)
    }

    // Must have at least one correct answer
    if (correctAnswerIndices.length === 0) {
        return null
    }

    return { question, description, answers, correctAnswerIndices }
}
