import Anthropic from '@anthropic-ai/sdk'
import type { OverseerResult } from '../schema/profile.schema'

const EDITOR_SYSTEM_PROMPT = `You are a surgical CV and cover letter editor.

You will receive:
1. The original CV in markdown
2. The original cover letter in markdown
3. A list of specific section-level feedback items pointing to headings that need improvement

Your task: rewrite ONLY the sections listed in the feedback. Do not touch any other sections.

For each section in the feedback:
- Address the specific issue described
- Apply the specific suggestion given
- Match the surrounding tone and style exactly
- Do NOT use em dashes (—) anywhere. Use commas, colons, or rewrite instead
- Use hyphens (-) for bullet/list items as normal
- The heading string in your output must exactly match the heading string provided in the feedback

Call edit_sections exactly once.`

const EDIT_TOOL: Anthropic.Tool = {
  name: 'edit_sections',
  description: 'Output the rewritten sections. Only include sections that were changed.',
  input_schema: {
    type: 'object' as const,
    properties: {
      cvSections: {
        type: 'array',
        description: 'Rewritten CV sections (only those that changed)',
        items: {
          type: 'object',
          properties: {
            heading: { type: 'string', description: 'Exact markdown heading string, e.g. "## EXPERIENCE"' },
            content: { type: 'string', description: 'Full replacement content for this section, not including the heading line itself' }
          },
          required: ['heading', 'content']
        }
      },
      coverLetterSections: {
        type: 'array',
        description: 'Rewritten cover letter sections (only those that changed)',
        items: {
          type: 'object',
          properties: {
            heading: { type: 'string', description: 'Exact markdown heading string' },
            content: { type: 'string', description: 'Full replacement content for this section, not including the heading line itself' }
          },
          required: ['heading', 'content']
        }
      }
    },
    required: ['cvSections', 'coverLetterSections']
  }
}

export interface EditorInput {
  cvMarkdown: string
  coverLetterMarkdown: string
  overseerResult: OverseerResult
  onChunk: (chunk: string) => void
}

export interface EditedDocs {
  cvMarkdown: string
  coverLetterMarkdown: string
}

// Replaces content between headings in a markdown document.
// heading: exact heading string e.g. "## EXPERIENCE"
// newContent: replacement content (does not include the heading line itself)
function patchSection(markdown: string, heading: string, newContent: string): string {
  const lines = markdown.split('\n')
  const headingIndex = lines.findIndex(l => l.trim() === heading.trim())
  if (headingIndex === -1) return markdown

  const headingLevel = (heading.match(/^(#+)/) ?? ['', ''])[1].length
  let endIndex = lines.length
  for (let i = headingIndex + 1; i < lines.length; i++) {
    const match = lines[i].match(/^(#+)\s/)
    if (match && match[1].length <= headingLevel) {
      endIndex = i
      break
    }
  }

  return [
    ...lines.slice(0, headingIndex + 1),
    newContent,
    ...lines.slice(endIndex)
  ].join('\n')
}

export async function runEditor(input: EditorInput): Promise<EditedDocs> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set.')

  const client = new Anthropic({ apiKey })

  const feedbackSummary = [
    'CV sections to fix:',
    ...input.overseerResult.feedback.cv.map(f => `  [${f.section}] Issue: ${f.issue} | Suggestion: ${f.suggestion}`),
    '\nCover letter sections to fix:',
    ...input.overseerResult.feedback.coverLetter.map(f => `  [${f.section}] Issue: ${f.issue} | Suggestion: ${f.suggestion}`)
  ].join('\n')

  const userMessage = [
    `Original CV:\n${input.cvMarkdown}`,
    `\nOriginal cover letter:\n${input.coverLetterMarkdown}`,
    `\nFeedback:\n${feedbackSummary}`
  ].join('\n')

  const stream = client.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    system: EDITOR_SYSTEM_PROMPT,
    tools: [EDIT_TOOL],
    tool_choice: { type: 'any' },
    messages: [{ role: 'user', content: userMessage }]
  })

  stream.on('text', (textDelta: string) => {
    input.onChunk(textDelta)
  })

  const finalMessage = await stream.finalMessage()

  for (const block of finalMessage.content) {
    if (block.type === 'tool_use' && block.name === 'edit_sections') {
      const result = block.input as {
        cvSections: Array<{ heading: string; content: string }>
        coverLetterSections: Array<{ heading: string; content: string }>
      }

      let cv = input.cvMarkdown
      let cl = input.coverLetterMarkdown

      for (const section of result.cvSections) {
        cv = patchSection(cv, section.heading, section.content)
      }
      for (const section of result.coverLetterSections) {
        cl = patchSection(cl, section.heading, section.content)
      }

      return { cvMarkdown: cv, coverLetterMarkdown: cl }
    }
  }

  throw new Error('Editor did not return structured edits.')
}
