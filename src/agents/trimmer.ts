import Anthropic from '@anthropic-ai/sdk'

const TRIMMER_SYSTEM_PROMPT = `You are a CV editor specialising in length reduction. You will receive a CV in markdown that is too long.

Current estimated length: {CURRENT_PAGES} pages. Target: {TARGET_PAGES} pages.

Rules, in priority order:
1. Shorten bullet points — say the same thing in fewer words
2. Cut the weakest achievements from each role, keeping the strongest 2-4 per role
3. Reduce roles ending more than 3 years ago to 2 bullets maximum
4. Reduce very early or junior roles to a single line: title, company, dates only
5. Never remove the Skills section, Portfolio highlights, or Education
6. Never cut achievements from the most recent role
7. Do not change any facts — only compress
8. Do not use em dashes

Call trimmed_cv exactly once with the result.`

const TRIMMED_CV_TOOL: Anthropic.Tool = {
  name: 'trimmed_cv',
  description: 'Output the length-reduced CV in markdown.',
  input_schema: {
    type: 'object' as const,
    properties: {
      cvMarkdown: {
        type: 'string',
        description: 'The trimmed CV in markdown'
      }
    },
    required: ['cvMarkdown']
  }
}

export interface TrimmerInput {
  cvMarkdown: string
  currentEstimatedPages: number
  targetPages: number
  onChunk: (chunk: string) => void
}

export async function runTrimmer(input: TrimmerInput): Promise<{ cvMarkdown: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set.')

  const client = new Anthropic({ apiKey })

  const systemPrompt = TRIMMER_SYSTEM_PROMPT
    .replace('{CURRENT_PAGES}', String(input.currentEstimatedPages))
    .replace('{TARGET_PAGES}', String(input.targetPages))

  const stream = client.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    system: systemPrompt,
    tools: [TRIMMED_CV_TOOL],
    tool_choice: { type: 'any' },
    messages: [{ role: 'user', content: input.cvMarkdown }]
  })

  stream.on('text', (textDelta: string) => {
    input.onChunk(textDelta)
  })

  const finalMessage = await stream.finalMessage()

  for (const block of finalMessage.content) {
    if (block.type === 'tool_use' && block.name === 'trimmed_cv') {
      const result = block.input as { cvMarkdown: string }
      return { cvMarkdown: result.cvMarkdown }
    }
  }

  throw new Error('Trimmer did not return a trimmed CV.')
}
