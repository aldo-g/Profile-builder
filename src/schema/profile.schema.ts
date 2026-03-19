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

export interface GapAnalysis {
  jobTitle: string
  company: string
  jobLocation: string
  missingSkills: string[]
  highlightExperience: string[]
  gaps: string[]
  score: number
  recommendedTweaks: string[]
  skillQuestions: Record<string, string>
  roleType: 'ic-junior' | 'ic-senior' | 'tech-lead' | 'engineering-manager' | 'product' | 'design' | 'data' | 'other'
  narrativeAngle: string
  gapSeverity: Record<string, 'hard' | 'soft'>
}

export interface JobAnalyseResult {
  analysis: GapAnalysis
  openingMessage: string
}

export interface SectionFeedback {
  section: string    // exact markdown heading e.g. "## EXPERIENCE"
  issue: string
  suggestion: string
}

export interface OverseerResult {
  pass: boolean
  score: number  // weighted average, 1 decimal place
  dimensions: {
    keyword_coverage: number       // weight 0.3
    narrative_coherence: number    // weight 0.2
    structural_completeness: number // weight 0.2
    holistic: number               // weight 0.3
  }
  feedback: {
    cv: SectionFeedback[]
    coverLetter: SectionFeedback[]
  }
}

export interface CompanyResearch {
  summary: string
  sources: string[]
  confidence: 'high' | 'medium' | 'low'
  productContext?: string
}

export interface GeneratedDocs {
  cvMarkdown: string
  coverLetterMarkdown: string
generatedAt: number
  jobTitle: string
  company: string
  overseerResult?: OverseerResult
}
