import Anthropic from '@anthropic-ai/sdk'
import type { GapAnalysis, OverseerResult } from '../schema/profile.schema'

const OVERSEER_SYSTEM_PROMPT = `You are a senior career document reviewer with expertise in CV quality assurance.

You will receive:
1. A tailored CV in markdown
2. A tailored cover letter in markdown
3. The gap analysis that guided their creation (shows required/missing skills and highlighted experience)
4. (Optional) Company research summary — if present, evaluate tone and culture fit against it

Score each dimension from 1 to 10:
- keyword_coverage (weight 30%): Does the CV address the required skills from the gap analysis? Are missing skills mentioned where the candidate has relevant experience? Are highlight experience entries prominent?
- narrative_coherence (weight 20%): Does the cover letter lead with the correct argument for the role type? Does the CV structure support that argument? Use the narrativeAngle field from the gap analysis as the benchmark. If no narrativeAngle is provided, fall back to evaluating tone against generic professional standards.
- structural_completeness (weight 20%): Are all expected CV sections present (contact, summary, experience, education, skills)? Is the cover letter structured (opening, body, close)?
- holistic (weight 30%): Overall quality, coherence, persuasiveness, absence of AI-tells (em dashes, generic filler phrases, passive language).

Scoring formula:
score = (keyword_coverage * 0.3) + (narrative_coherence * 0.2) + (structural_completeness * 0.2) + (holistic * 0.3)
Round to one decimal place.

pass = score >= 8.0

If score < 8.0, provide specific, actionable feedback for each failing dimension. Section names in feedback MUST exactly match the markdown heading strings in the documents (copy them verbatim, including ## prefix and capitalisation). Do not provide feedback for dimensions scoring 8 or above.

Call review_documents exactly once.`

const REVIEW_TOOL: Anthropic.Tool = {
  name: 'review_documents',
  description: 'Output the structured quality review of the CV and cover letter.',
  input_schema: {
    type: 'object' as const,
    properties: {
      dimensions: {
        type: 'object',
        properties: {
          keyword_coverage: { type: 'number', description: '1–10' },
          narrative_coherence: { type: 'number', description: '1–10' },
          structural_completeness: { type: 'number', description: '1–10' },
          holistic: { type: 'number', description: '1–10' }
        },
        required: ['keyword_coverage', 'narrative_coherence', 'structural_completeness', 'holistic']
      },
      score: { type: 'number', description: 'Weighted average 0–10, one decimal place' },
      pass: { type: 'boolean', description: 'true if score >= 8.0' },
      feedback: {
        type: 'object',
        properties: {
          cv: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                section: { type: 'string', description: 'Exact markdown heading of the section to fix — copy verbatim from the document' },
                issue: { type: 'string' },
                suggestion: { type: 'string' }
              },
              required: ['section', 'issue', 'suggestion']
            }
          },
          coverLetter: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                section: { type: 'string', description: 'Exact markdown heading of the section to fix — copy verbatim from the document' },
                issue: { type: 'string' },
                suggestion: { type: 'string' }
              },
              required: ['section', 'issue', 'suggestion']
            }
          }
        },
        required: ['cv', 'coverLetter']
      }
    },
    required: ['dimensions', 'score', 'pass', 'feedback']
  }
}

export interface OverseerInput {
  cvMarkdown: string
  coverLetterMarkdown: string
  analysis: GapAnalysis
  companySummary?: string
}

export async function runOverseer(input: OverseerInput): Promise<OverseerResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set.')

  const client = new Anthropic({ apiKey })

  const companySection = input.companySummary
    ? `Company research summary:\n${input.companySummary}`
    : 'No company research available — evaluate tone against generic professional standards.'

  const roleTypeLine = input.analysis.roleType ? `Role type: ${input.analysis.roleType}` : ''
  const narrativeLine = input.analysis.narrativeAngle ? `Narrative angle: ${input.analysis.narrativeAngle}` : ''

  const userMessage = [
    `CV:\n${input.cvMarkdown}`,
    `\nCover letter:\n${input.coverLetterMarkdown}`,
    `\nGap analysis:\n${JSON.stringify(input.analysis, null, 2)}`,
    roleTypeLine,
    narrativeLine,
    `\n${companySection}`
  ].filter(Boolean).join('\n')

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: OVERSEER_SYSTEM_PROMPT,
    tools: [REVIEW_TOOL],
    tool_choice: { type: 'any' },
    messages: [{ role: 'user', content: userMessage }]
  })

  for (const block of response.content) {
    if (block.type === 'tool_use' && block.name === 'review_documents') {
      return block.input as OverseerResult
    }
  }

  throw new Error('Overseer did not return structured review.')
}
