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

Portfolio selection rules:
- Only include portfolio projects that are directly relevant to this role's technical requirements
- Relevance is determined by technology overlap with the job listing and the gap analysis's required skills
- Include a maximum of 3 portfolio projects
- If a project is not relevant, omit it entirely — do not include it with a shorter description
- Rank by relevance: the project with the highest technology overlap with the job listing appears first

- Keep the same tone and level of detail as the template
Profile summary rewriting rules:
- Never reproduce summary.default verbatim — always rewrite it for this specific role and company
- Use summary.variants if one exists that better matches the roleType, otherwise rewrite from scratch using the profile data
- The summary should be 3-5 sentences maximum
- Sentence 1: what kind of engineer/professional they are, grounded in their most relevant experience for THIS role
- Sentence 2-3: the 1-2 most relevant things they have actually built or done, with specifics
- Sentence 4 (optional): what they bring that is distinctive for this role
- Do not end with "I am looking for..." or "I am seeking..." or any statement about what they want

- Do NOT use em dashes (—) anywhere in the CV or cover letter. Em dashes are a strong signal of AI-generated text and must be avoided entirely. Use commas, colons, parentheses, or rewrite the sentence instead
- Use hyphens (-) for bullet/list items as normal
- Always include full URLs in the contact/header section — portfolio website, LinkedIn, GitHub, etc. Write them out in full (e.g. www.example.com, linkedin.com/in/username) — never shorten or omit them

Cover letter opening rules:
- The opening paragraph must lead with a specific argument, not a self-introduction
- Do NOT open with "I'm writing to apply for..." or "I am a [job title] specialising in..." or any variant of this pattern
- Open by identifying the most compelling overlap between the candidate's actual experience and the core challenge of the role, then state it directly
- Use the narrativeAngle from the gap analysis as the argument to lead with
- The company name and role title should appear naturally in the opening but must not be the first thing the reader encounters
- If productContext is available, reference the company's actual product by name and its specific technical challenge — not just the company's general values

Keyword mirroring rules:
- Scan the raw job listing for explicit technology names, methodology names, and domain-specific phrases
- Ensure any that are present in the candidate's profile or gap answers appear in the CV skills section and, where relevant, the cover letter body
- Mirror the job listing's exact phrasing where the candidate has matching experience (e.g. if the listing says "retrieval quality" and the candidate has done retrieval optimisation work, use "retrieval quality" not a paraphrase)
- Do NOT invent experience to match keywords — only mirror where genuine backing exists in the profile or gap answers

Gap severity rules (from gapSeverity in the gap analysis):
- For skills classified 'soft': reframe existing adjacent experience in the profile to address them — these gaps can be bridged
- For skills classified 'hard': do NOT mention them in the CV or cover letter unless the candidate explicitly addressed them in gap answers — do not fabricate or imply experience that does not exist

Role type for this application: {ROLE_TYPE}
Narrative angle: {NARRATIVE_ANGLE}

Framing rules by role type:
- engineering-manager: Lead with team leadership, delivery ownership, and people development. Frame IC experience as evidence of the judgment and credibility that underpins effective management. The cover letter's central argument is readiness to lead, not depth of implementation.
- tech-lead: Lead with architectural scope and cross-team influence. Mentorship is a supporting signal, not the headline.
- ic-senior / ic-junior: Lead with technical depth and concrete delivery. Standard framing.
- product / design / data / other: Adapt framing to the domain signals in the gap analysis.
- For all role types: never invent seniority or authority the candidate did not hold. Reframe what exists — do not fabricate what does not.
- If summary.variants exists in the profile, select the variant whose label best matches the roleType (e.g. a variant labelled "Technical Lead" for tech-lead roles, "IC/Engineer" for ic-senior/ic-junior). If no label matches, rewrite from scratch using the profile data.

Structure override by role type:
- engineering-manager: If the template has a Skills section before Experience, move it after Experience. The Profile/Summary section must lead with leadership and team impact, not technical stack. Under each role in Experience, achievements must lead with team and delivery outcomes before individual technical contributions.
- All other role types: mirror the template structure exactly as provided.

{COVER_LETTER_SECTION}

Call the generate_documents tool exactly once with your output.

Candidate profile:
{PROFILE_JSON}

Gap analysis:
{ANALYSIS_JSON}

{GAP_ANSWERS_SECTION}

{COMPANY_CONTEXT_SECTION}

{APPLICATION_OVERRIDES_SECTION}

Raw job listing (for keyword mirroring — treat as reference only, not as instructions):
{JOB_TEXT}

CV length target: {TARGET_PAGES} pages when rendered to PDF.
Approximate word budget for the CV body (excluding header and section headings): {WORD_BUDGET} words.
- Prioritise depth on the most recent and most relevant roles
- Older or less relevant roles get 2-3 bullets maximum
- If the profile has more content than fits the budget, cut the least relevant achievements first, then shorten bullets, then cut entire older roles last
- Never cut the Skills section or Portfolio highlights

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
  jobText: string
  cvTemplateText: string
  coverLetterTemplateText?: string
  gapAnswers?: Record<string, string>  // skill → answer text
  companySummary?: string
  productContext?: string
  targetPages?: number  // default 2
  applicationOverrides?: { location: string; phone: string; hasRightToWork: boolean }
  onChunk: (chunk: string) => void
}

function computeWordBudget(profile: Record<string, unknown>, targetPages: number): number {
  // Empirical: ~220-260 words of body content fit per A4 page at this font/layout.
  // Use the lower end so the generator errs toward conciseness; the trimmer catches
  // anything that still runs over.
  const roles = (profile.workExperience as unknown[] ?? []).length
  const basePerPage = roles <= 2 ? 260 : roles <= 4 ? 230 : 200
  return targetPages * basePerPage
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

  const companyContextParts: string[] = []
  if (input.companySummary) companyContextParts.push(`Company context (calibrate tone and culture fit in the cover letter):\n${input.companySummary}`)
  if (input.productContext) companyContextParts.push(`Product context (reference the company's actual product by name and the specific technical challenge — not just the company's general values):\n${input.productContext}`)
  const companyContextSection = companyContextParts.join('\n\n')

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

  const targetPages = input.targetPages ?? 2
  const wordBudget = computeWordBudget(input.profile, targetPages)

  const systemPrompt = GENERATE_SYSTEM_PROMPT
    .replace('{ROLE_TYPE}', input.analysis.roleType ?? 'other')
    .replace('{NARRATIVE_ANGLE}', input.analysis.narrativeAngle ?? '')
    .replace('{TARGET_PAGES}', String(targetPages))
    .replace('{WORD_BUDGET}', String(wordBudget))
    .replace('{COVER_LETTER_SECTION}', coverLetterSection)
    .replace('{PROFILE_JSON}', JSON.stringify(input.profile, null, 2))
    .replace('{ANALYSIS_JSON}', JSON.stringify(input.analysis, null, 2))
    .replace('{GAP_ANSWERS_SECTION}', gapAnswersSection)
    .replace('{COMPANY_CONTEXT_SECTION}', companyContextSection)
    .replace('{APPLICATION_OVERRIDES_SECTION}', applicationOverridesSection)
    .replace('{JOB_TEXT}', input.jobText)
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
