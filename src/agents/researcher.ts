import Anthropic from '@anthropic-ai/sdk'
import type { CompanyResearch } from '../schema/profile.schema'

const RESEARCHER_SYSTEM_PROMPT = `You are a company research assistant helping a job applicant understand an employer before applying.

Your task:
1. Use the web_search tool to research the company: find their mission, culture, tone, products/services, and any recent news from the past 12 months.
2. Synthesise what you find into a 3–5 sentence plain-English summary that captures the company's identity, how they communicate, and what they value in employees.
3. Call the report_company tool exactly once with your findings.

Be factual and grounded in search results. Do not speculate. If search results are thin, say so and set confidence to "low".

Company to research: {COMPANY_NAME}`

const REPORT_COMPANY_TOOL: Anthropic.Tool = {
  name: 'report_company',
  description: 'Report structured findings about the company.',
  input_schema: {
    type: 'object' as const,
    properties: {
      summary: {
        type: 'string',
        description: '3–5 sentence plain-English summary of the company: identity, culture, tone, what they value'
      },
      sources: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of URLs that were useful sources for this summary'
      },
      confidence: {
        type: 'string',
        enum: ['high', 'medium', 'low'],
        description: 'How confident are you in the accuracy and completeness of this summary?'
      }
    },
    required: ['summary', 'sources', 'confidence']
  }
}

export interface ResearcherInput {
  company: string
  onChunk: (chunk: string) => void
}

export async function runResearcher(input: ResearcherInput): Promise<CompanyResearch> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set.')

  const client = new Anthropic({ apiKey })

  input.onChunk(`Searching the web for information about ${input.company}…`)

  const systemPrompt = RESEARCHER_SYSTEM_PROMPT.replace('{COMPANY_NAME}', input.company)

  // Use beta.messages for web_search support
  const response = await (client.beta.messages as any).create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: systemPrompt,
    tools: [
      { type: 'web_search_20250305', name: 'web_search' },
      REPORT_COMPANY_TOOL
    ],
    messages: [{ role: 'user', content: `Research this company for me: ${input.company}` }],
    betas: ['web_search_2025_03_05']
  })

  for (const block of response.content) {
    if (block.type === 'tool_use' && block.name === 'report_company') {
      return block.input as CompanyResearch
    }
  }

  throw new Error('Researcher did not return structured company data.')
}
