import Anthropic from '@anthropic-ai/sdk'
import type { AgentResponse } from '../schema/profile.schema'

const SYSTEM_PROMPT = `You are a professional career profiler building a comprehensive JSON profile of the user.

Your job is to extract structured professional information through conversation and document analysis.

Rules:
- Extract data from whatever the user provides (CVs, job descriptions, certificates, free text)
- Build and maintain a JSON profile that captures: work experience, education, certifications, skills, portfolio projects (personal/side projects and open-source only — not work projects), languages, and soft skills
- After extracting, ask targeted follow-up questions — no more than 3 at a time
- Be specific in your questions. "What was the tech stack for [project]?" not "Can you tell me more?"
- Acknowledge what you already know — never ask for something already in the profile
- If the user corrects something, update the profile and confirm the change

When a user describes an achievement, always push for specifics before saving:
- Numbers: team size, users affected, performance improvement percentages, time saved, money involved
- Before/after: what existed before, what you built, what changed
- Scope: how many systems, documents, people, services

If the user gives a vague achievement like "I improved performance" or "I mentored the team", ask one follow-up before saving: "Can you put a number on that — how much faster, how many people, what was the before/after?" Save the enriched version, not the vague one.

When you have profile data to save, call the update_profile tool with the relevant fields.
You can call it with an empty object if there is nothing to update yet.
Always call update_profile exactly once per response.

Current profile state:
{PROFILE_JSON}

Current section: {CURRENT_SECTION}`

const UPDATE_PROFILE_TOOL: Anthropic.Tool = {
  name: 'update_profile',
  description: 'Save extracted profile data. Call this once per response with any fields to update. Pass an empty object if nothing to update.',
  input_schema: {
    type: 'object' as const,
    properties: {
      profileUpdates: {
        type: 'object',
        description: 'Profile fields to update, using the same top-level keys as the profile JSON (e.g. personal, workExperience, skills). Pass {} if nothing to update.'
      }
    },
    required: ['profileUpdates']
  }
}

export async function generateSectionQuestions(profile: object, section: string): Promise<string[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set')

  const client = new Anthropic({ apiKey })

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    system: `You are a career profile assistant. Given a user's current profile and a section name, generate exactly 3 short, specific questions that would help expand that section with richer detail. Questions should be concrete and answerable in a sentence or two — not broad. Return ONLY a JSON array of 3 strings, no other text.`,
    messages: [{
      role: 'user',
      content: `Section: ${section}\n\nCurrent profile:\n${JSON.stringify(profile, null, 2)}`
    }]
  })

  const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '[]'
  try {
    const parsed = JSON.parse(text)
    return Array.isArray(parsed) ? parsed.slice(0, 3) : []
  } catch {
    return []
  }
}

export interface InterviewerInput {
  userMessage: string
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
  profile: object
  section: string
  onChunk: (chunk: string) => void
}

export async function runInterviewer(input: InterviewerInput): Promise<AgentResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set. Please set it in your environment before starting the app.')
  }

  const client = new Anthropic({ apiKey })

  const systemPrompt = SYSTEM_PROMPT
    .replace('{PROFILE_JSON}', JSON.stringify(input.profile, null, 2))
    .replace('{CURRENT_SECTION}', input.section)

  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
    ...input.conversationHistory,
    { role: 'user', content: input.userMessage }
  ]

  const stream = client.messages.stream({
    model: 'claude-opus-4-6',
    max_tokens: 4096,
    system: systemPrompt,
    tools: [UPDATE_PROFILE_TOOL],
    tool_choice: { type: 'auto' },
    messages
  })

  let messageText = ''
  let profileUpdates: Record<string, unknown> = {}

  stream.on('text', (textDelta: string) => {
    messageText += textDelta
    input.onChunk(textDelta)
  })

  const finalMessage = await stream.finalMessage()

  // Extract profile updates from tool call if present
  for (const block of finalMessage.content) {
    if (block.type === 'tool_use' && block.name === 'update_profile') {
      const toolInput = block.input as { profileUpdates?: Record<string, unknown> }
      if (toolInput.profileUpdates && Object.keys(toolInput.profileUpdates).length > 0) {
        profileUpdates = toolInput.profileUpdates
      }
    }
  }

  return {
    message: messageText.trim() || 'Done.',
    profileUpdates,
    questions: []
  }
}
