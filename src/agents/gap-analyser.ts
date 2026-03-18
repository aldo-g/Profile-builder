import Anthropic from '@anthropic-ai/sdk'
import type { AgentResponse, GapAnalysis } from '../schema/profile.schema'

const ANALYSE_SYSTEM_PROMPT = `You are a career gap analyst. Given a job listing and a candidate's profile JSON, produce a structured gap analysis.

Identify:
- Skills explicitly required or strongly implied by the job listing that are absent from the profile
- Areas of the profile that are weak or underdeveloped relative to this role
- Experience entries in the profile most relevant to highlight for this application
- A fit score from 0 (no match) to 100 (perfect match)
- Concrete additions or edits the candidate should make to strengthen their candidacy
- For each missing skill, one specific, targeted question to ask the candidate (e.g. "Have you worked with vector databases like Pinecone or Weaviate? If so, in what context?"). Questions must be concrete and reference the candidate's existing experience where possible.

Additionally, infer:
- roleType: classify the role from the listing. Use 'engineering-manager' if the listing mentions direct reports, team ownership, hiring, or performance management. Use 'tech-lead' if it mentions architectural ownership or mentorship without direct reports. Use 'ic-senior' for senior individual contributors. Use 'product', 'design', or 'data' for those respective domains. Default to 'other'.
- narrativeAngle: write one sentence describing the primary argument the cover letter should make for THIS candidate against THIS job. Reference the candidate's actual strongest relevant experience. E.g. "Frame the candidate's RAG pipeline work and junior engineer mentorship at Rabobank as evidence of readiness to lead an AI-native engineering team."

Call the analyse_gap tool exactly once with the structured data.

Current profile:
{PROFILE_JSON}

Job listing:
{JOB_TEXT}`

const ANALYSE_GAP_TOOL: Anthropic.Tool = {
  name: 'analyse_gap',
  description: 'Produce a structured gap analysis comparing the job listing to the candidate profile.',
  input_schema: {
    type: 'object' as const,
    properties: {
      jobTitle: {
        type: 'string',
        description: 'The job title extracted from the listing (e.g. "Senior Software Engineer")'
      },
      company: {
        type: 'string',
        description: 'The company name extracted from the listing. Use empty string if not found.'
      },
      jobLocation: {
        type: 'string',
        description: 'The job location extracted from the listing (e.g. "Berlin, Germany", "Remote", "London, UK"). Use empty string if not specified.'
      },
      missingSkills: {
        type: 'array',
        items: { type: 'string' },
        description: 'Skills required by the job listing that are absent from the profile'
      },
      highlightExperience: {
        type: 'array',
        items: { type: 'string' },
        description: 'Short descriptions of profile experience most relevant to highlight for this role'
      },
      gaps: {
        type: 'array',
        items: { type: 'string' },
        description: 'Broader areas where the candidate is weak relative to this job'
      },
      score: {
        type: 'number',
        description: 'Fit score from 0 to 100'
      },
      recommendedTweaks: {
        type: 'array',
        items: { type: 'string' },
        description: 'Concrete additions or edits to the profile that would strengthen the application'
      },
      skillQuestions: {
        type: 'object',
        description: 'A map of missing skill name → one specific question to ask the candidate about their experience with that skill',
        additionalProperties: { type: 'string' }
      },
      roleType: {
        type: 'string',
        enum: ['ic-junior', 'ic-senior', 'tech-lead', 'engineering-manager', 'product', 'design', 'data', 'other'],
        description: "The nature of the role inferred from the listing. Use 'engineering-manager' for roles with direct reports, team ownership, or delivery ownership. Use 'tech-lead' for senior ICs with architectural/mentorship scope."
      },
      narrativeAngle: {
        type: 'string',
        description: "One sentence describing the primary argument the cover letter should make, e.g. 'Frame the candidate as a proven backend engineer making a natural transition into technical leadership, with evidence of mentorship and architectural ownership.'"
      }
    },
    required: ['jobTitle', 'company', 'jobLocation', 'missingSkills', 'highlightExperience', 'gaps', 'score', 'recommendedTweaks', 'skillQuestions', 'roleType', 'narrativeAngle']
  }
}

const CHAT_SYSTEM_PROMPT = `You are a career gap analyst helping a candidate strengthen their profile for a specific job listing.

Gap analysis summary:
{ANALYSIS_JSON}

Job listing:
{JOB_TEXT}

Current profile:
{PROFILE_JSON}

Rules:
- Ask targeted follow-up questions to uncover experience or skills the candidate has that would address the identified gaps
- No more than 2 questions per response
- Only call update_profile if the user gives a concrete, affirmative example (a specific project, role, tool used, outcome, etc.)
- If the user says "no", "not really", "I haven't", "I don't have experience with that", or gives a vague or negative answer, do NOT call update_profile — pass an empty object
- Never invent or infer experience that wasn't explicitly described by the user
- Acknowledge what you already know — never ask for something already in the profile
- Be specific: "Did you use Kubernetes in your DevOps work at Acme?" not "Tell me about your cloud experience"
- Always call update_profile exactly once per response (with an empty object if nothing to save)`

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

export interface GapAnalyserInput {
  jobText: string
  profile: Record<string, unknown>
}

export interface GapAnalyserChatInput {
  userMessage: string
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
  jobText: string
  analysis: GapAnalysis
  profile: Record<string, unknown>
  onChunk: (chunk: string) => void
}

export async function runGapAnalyser(
  input: GapAnalyserInput
): Promise<{ analysis: GapAnalysis }> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set.')

  const client = new Anthropic({ apiKey })

  const systemPrompt = ANALYSE_SYSTEM_PROMPT
    .replace('{PROFILE_JSON}', JSON.stringify(input.profile, null, 2))
    .replace('{JOB_TEXT}', input.jobText)

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: systemPrompt,
    tools: [ANALYSE_GAP_TOOL],
    tool_choice: { type: 'any' },
    messages: [{ role: 'user', content: 'Please analyse this job listing against my profile.' }]
  })

  let analysis: GapAnalysis | null = null

  for (const block of response.content) {
    if (block.type === 'tool_use' && block.name === 'analyse_gap') {
      analysis = block.input as GapAnalysis
      if (!analysis.skillQuestions) analysis.skillQuestions = {}
      if (!analysis.jobTitle) analysis.jobTitle = 'Untitled role'
      if (!analysis.company) analysis.company = ''
      if (!analysis.jobLocation) analysis.jobLocation = ''
      if (!analysis.roleType) analysis.roleType = 'other'
      if (!analysis.narrativeAngle) analysis.narrativeAngle = ''
    }
  }

  if (!analysis) throw new Error('Gap analyser did not return structured analysis.')

  return { analysis }
}

export async function runGapAnalyserChat(input: GapAnalyserChatInput): Promise<AgentResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set.')

  const client = new Anthropic({ apiKey })

  const systemPrompt = CHAT_SYSTEM_PROMPT
    .replace('{ANALYSIS_JSON}', JSON.stringify(input.analysis, null, 2))
    .replace('{JOB_TEXT}', input.jobText)
    .replace('{PROFILE_JSON}', JSON.stringify(input.profile, null, 2))

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
