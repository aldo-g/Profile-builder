// Shared TypeScript types used across main process, preload, and renderer

export interface AgentResponse {
  message: string
  profileUpdates: Record<string, unknown>
  questions: string[]
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export interface ProfileData {
  meta: {
    version: string
    createdAt: string
    updatedAt: string
    sources: Array<{ type: string; importedAt: string; filename?: string }>
    completeness: Record<string, number>
  }
  personal: Record<string, unknown>
  summary: { default: string; variants: Array<{ label: string; content: string }> }
  workExperience: unknown[]
  education: unknown[]
  certifications: unknown[]
  skills: { technical: unknown[]; domains: unknown[]; tools: unknown[] }
  portfolio: unknown[]
  languages: unknown[]
  softSkills: unknown[]
  references: unknown[]
  extras: Record<string, unknown>
}

export interface ChatSendPayload {
  message: string
  section: string
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
  profile: ProfileData
}

export interface ChatDonePayload {
  agentResponse: AgentResponse
  updatedProfile: ProfileData
}

export interface ChatErrorPayload {
  error: string
}
