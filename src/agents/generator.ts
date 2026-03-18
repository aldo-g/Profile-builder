import Anthropic from '@anthropic-ai/sdk'
import type { GapAnalysis, GeneratedDocs } from '../schema/profile.schema'

const GENERATE_SYSTEM_PROMPT = `You are a professional CV and cover letter writer.

You have been given:
1. The candidate's full profile JSON
2. A gap analysis comparing their profile to a specific job listing
3. The text content of their existing CV template — use this as a guide for structure, section order, tone, and level of detail
4. (Optional) The candidate's own answers to gap questions — treat these as additional context to incorporate where relevant, even if not yet in the profile
5. (Optional) Company research context — use this to calibrate the tone and culture fit of the cover letter

The template is a structural guide, not a script. Do NOT copy specific phrases, personal details, or context-specific statements from the template — especially anything about location, visa status, work authorisation, availability, or job-seeking intent. These details must come from the profile JSON and any application overrides, not from the template text.

Your task:
- Write a tailored CV in markdown that follows the structure and section ordering of their template CV as a guide
- Write a matching cover letter in markdown
- Emphasise the experience listed in highlightExperience and frame skills to address the job's requirements
- Incorporate relevant detail from the candidate's gap answers where it strengthens the application
- Do NOT invent experience — only use what is in the profile or explicitly stated in the gap answers
- Do NOT include sections that are empty in the profile
- Keep the same tone and level of detail as the template
- Do NOT use em dashes (—) anywhere in the CV or cover letter. Em dashes are a strong signal of AI-generated text and must be avoided entirely. Use commas, colons, parentheses, or rewrite the sentence instead
- Use hyphens (-) for bullet/list items as normal
- Use the job title and company from the gap analysis in the cover letter opening
- Always include full URLs in the contact/header section — portfolio website, LinkedIn, GitHub, etc. Write them out in full (e.g. www.example.com, linkedin.com/in/username) — never shorten or omit them

Role type for this application: {ROLE_TYPE}
Narrative angle: {NARRATIVE_ANGLE}

Framing rules by role type:
- engineering-manager: Lead with team leadership, delivery ownership, and people development. Frame IC experience as evidence of the judgment and credibility that underpins effective management. The cover letter's central argument is readiness to lead, not depth of implementation.
- tech-lead: Lead with architectural scope and cross-team influence. Mentorship is a supporting signal, not the headline.
- ic-senior / ic-junior: Lead with technical depth and concrete delivery. Standard framing.
- product / design / data / other: Adapt framing to the domain signals in the gap analysis.
- For all role types: never invent seniority or authority the candidate did not hold. Reframe what exists — do not fabricate what does not.
- If summary.variants exists in the profile, select the variant whose content best matches the roleType and narrativeAngle rather than defaulting to summary.default.

{COVER_LETTER_SECTION}

Call the generate_documents tool exactly once with your output.

Candidate profile:
{PROFILE_JSON}

Gap analysis:
{ANALYSIS_JSON}

{GAP_ANSWERS_SECTION}

{COMPANY_CONTEXT_SECTION}

{APPLICATION_OVERRIDES_SECTION}

CV template structure (extracted text — mirror this structure):
{CV_TEMPLATE_TEXT}`

const GENERATE_DOCS_TOOL: Anthropic.Tool = {
  name: 'generate_documents',
  description: 'Output the tailored CV and cover letter in markdown.',
  input_schema: {
    type: 'object' as const,
    properties: {
      cvMarkdown: {
        type: 'string',
        description: 'The tailored CV in markdown, matching the structure of the provided template'
      },
      coverLetterMarkdown: {
        type: 'string',
        description: 'The tailored cover letter in markdown'
      }
    },
    required: ['cvMarkdown', 'coverLetterMarkdown']
  }
}

export interface GeneratorInput {
  profile: Record<string, unknown>
  analysis: GapAnalysis
  cvTemplateText: string
  coverLetterTemplateText?: string
  gapAnswers?: Record<string, string>  // skill → answer text
  companySummary?: string
  applicationOverrides?: { location: string; phone: string; hasRightToWork: boolean }
  onChunk: (chunk: string) => void
}

export async function runGenerator(input: GeneratorInput): Promise<GeneratedDocs> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set.')

  const client = new Anthropic({ apiKey })

  const coverLetterSection = input.coverLetterTemplateText
    ? `Cover letter template structure (mirror this format):\n${input.coverLetterTemplateText}`
    : 'No cover letter template provided — use a standard professional format with 3–4 paragraphs.'

  const gapAnswersSection = input.gapAnswers && Object.keys(input.gapAnswers).length > 0
    ? `Candidate's answers to gap questions:\n${Object.entries(input.gapAnswers).map(([skill, answer]) => `- ${skill}: ${answer}`).join('\n')}`
    : ''

  const companyContextSection = input.companySummary
    ? `Company context (calibrate tone and culture fit in the cover letter):\n${input.companySummary}`
    : ''

  let applicationOverridesSection = ''
  const lines: string[] = [
    'Application overrides — use these values in the CV and cover letter, overriding anything in the profile or template:',
  ]
  if (input.applicationOverrides) {
    const o = input.applicationOverrides
    if (o.location) lines.push(`- Location: ${o.location}`)
    if (o.phone) lines.push(`- Phone: ${o.phone}`)
    lines.push(o.hasRightToWork
      ? '- Right to work: Candidate has the right to work — state this clearly and do NOT mention visa sponsorship anywhere in either document'
      : '- Right to work: Do NOT include any statement about right to work, visa status, or sponsorship anywhere in either document. If the CV template contains such a line, omit it entirely — do not copy it across'
    )
  } else {
    lines.push('- Do NOT include any statement about visa status, work authorisation, sponsorship, WHV, working holiday, or availability for short-term contracts unless explicitly stated in the profile JSON. Do not copy any such statements from the template.')
    lines.push('- For location: use the location from the profile JSON. Do not copy the location from the template.')
  }
  applicationOverridesSection = lines.join('\n')

  const systemPrompt = GENERATE_SYSTEM_PROMPT
    .replace('{ROLE_TYPE}', input.analysis.roleType ?? 'other')
    .replace('{NARRATIVE_ANGLE}', input.analysis.narrativeAngle ?? '')
    .replace('{COVER_LETTER_SECTION}', coverLetterSection)
    .replace('{PROFILE_JSON}', JSON.stringify(input.profile, null, 2))
    .replace('{ANALYSIS_JSON}', JSON.stringify(input.analysis, null, 2))
    .replace('{GAP_ANSWERS_SECTION}', gapAnswersSection)
    .replace('{COMPANY_CONTEXT_SECTION}', companyContextSection)
    .replace('{APPLICATION_OVERRIDES_SECTION}', applicationOverridesSection)
    .replace('{CV_TEMPLATE_TEXT}', input.cvTemplateText)

  const stream = client.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    system: systemPrompt,
    tools: [GENERATE_DOCS_TOOL],
    tool_choice: { type: 'any' },
    messages: [{ role: 'user', content: 'Please generate my tailored CV and cover letter.' }]
  })

  stream.on('text', (textDelta: string) => {
    input.onChunk(textDelta)
  })

  const finalMessage = await stream.finalMessage()

  for (const block of finalMessage.content) {
    if (block.type === 'tool_use' && block.name === 'generate_documents') {
      const result = block.input as { cvMarkdown: string; coverLetterMarkdown: string }
      return {
        cvMarkdown: result.cvMarkdown,
        coverLetterMarkdown: result.coverLetterMarkdown,
        generatedAt: Date.now(),
        jobTitle: input.analysis.jobTitle,
        company: input.analysis.company
      }
    }
  }

  throw new Error('Generator did not return structured documents.')
}
