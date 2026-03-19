import Anthropic from '@anthropic-ai/sdk'
import type { CompanyResearch } from '../schema/profile.schema'

const RESEARCHER_SYSTEM_PROMPT = `You are a company research assistant helping a job applicant understand an employer before applying.

Your task:
1. Use the web_search tool to research the company: find their mission, culture, tone, products/services, and any recent news from the past 12 months.
2. Synthesise what you find into a 3–5 sentence plain-English summary that captures the company's identity, how they communicate, and what they value in employees.
3. Separately, identify what specific product or service the candidate would be working on — the actual thing being built, the technical challenges it involves, and any relevant engineering context. Write 1–2 sentences specifically about this as productContext.
4. Call the report_company tool exactly once with your findings.

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
      },
      productContext: {
        type: 'string',
        description: 'One or two sentences specifically about the product or service the candidate would be working on, and the technical challenges it involves. This is distinct from the company summary — focus on what they build, not who they are.'
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

  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: `Research this company for me: ${input.company}` }
  ]

  const tools: any[] = [
    { type: 'web_search_20250305', name: 'web_search' },
    REPORT_COMPANY_TOOL
  ]

  // Agentic loop: web_search_20250305 is a server-side tool — the API executes searches
  // automatically and embeds results in the response content. We only need to handle
  // report_company (our client-side tool) by returning its input.
  try {
    for (let turn = 0; turn < 10; turn++) {
      const response = await (client.beta.messages as any).create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: systemPrompt,
        tools,
        messages,
        betas: ['web_search_2025_03_05']
      })

      // Stream any text chunks to the UI
      for (const block of response.content) {
        if (block.type === 'text' && block.text) {
          input.onChunk(block.text)
        }
      }

      // Check for report_company — return immediately when found
      for (const block of response.content) {
        if (block.type === 'tool_use' && block.name === 'report_company') {
          return block.input as CompanyResearch
        }
      }

      // Model finished a turn without calling report_company.
      // Prompt it to now call report_company with its findings.
      messages.push({ role: 'assistant', content: response.content })
      messages.push({ role: 'user', content: 'Now call the report_company tool with your findings.' })
    }
  } catch (err: unknown) {
    const reason = err instanceof Error ? err.message : String(err)
    input.onChunk(`\n[Research unavailable: ${reason}. Continuing without company context.]`)
    return {
      summary: `Company research was unavailable (${reason}). The cover letter will be written without specific company context.`,
      sources: [],
      confidence: 'low'
    }
  }

  // Exhausted turns without a result — return a stub rather than throwing,
  // so the generation pipeline can continue without company context.
  input.onChunk('\n[Research timed out. Continuing without company context.]')
  return {
    summary: `Research for ${input.company} did not complete in time. The cover letter will be written without specific company context.`,
    sources: [],
    confidence: 'low'
  }
}
