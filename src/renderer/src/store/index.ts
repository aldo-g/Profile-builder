import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { GapAnalysis, GeneratedDocs, OverseerResult } from '../../../schema/profile.schema'

export type AppPage = 'intro' | 'interview' | 'job-match' | 'generate' | 'import' | 'history'

export interface JobSession {
  id: string
  name: string          // editable display name
  jobText: string
  analysis: GapAnalysis | null
  analysing: boolean
  cardIndex: number
  answered: number[]    // card indices answered
  skipped: number[]     // card indices skipped
  answers: Record<number, string>  // card index → user's answer text
  createdAt: number
  generatedDocs: GeneratedDocs | null
  generating: boolean
  companySummary?: string
  productContext?: string
  overseerResult?: OverseerResult
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export interface WizardSection {
  id: string
  label: string
  description: string
  profileKey: string
  completionCheck: (profile: Record<string, unknown>) => boolean
}

export const WIZARD_SECTIONS: WizardSection[] = [
  {
    id: 'personal',
    label: 'Personal Info',
    description: 'Your name, contact details, and location',
    profileKey: 'personal',
    completionCheck: (profile) => {
      const p = profile.personal as Record<string, unknown>
      return Boolean(p?.fullName && p?.email)
    }
  },
  {
    id: 'work-experience',
    label: 'Work Experience',
    description: 'Your roles, responsibilities, and achievements',
    profileKey: 'workExperience',
    completionCheck: (profile) => {
      const w = profile.workExperience as unknown[]
      return Array.isArray(w) && w.length > 0
    }
  },
  {
    id: 'education',
    label: 'Education',
    description: 'Degrees, institutions, and qualifications',
    profileKey: 'education',
    completionCheck: (profile) => {
      const e = profile.education as unknown[]
      return Array.isArray(e) && e.length > 0
    }
  },
  {
    id: 'certifications',
    label: 'Certifications',
    description: 'Professional certifications and credentials',
    profileKey: 'certifications',
    completionCheck: (profile) => {
      const c = profile.certifications as unknown[]
      return Array.isArray(c) && c.length > 0
    }
  },
  {
    id: 'skills',
    label: 'Skills',
    description: 'Technical skills, tools, and domains',
    profileKey: 'skills',
    completionCheck: (profile) => {
      const s = profile.skills as { technical: unknown[] } | undefined
      return Boolean(s?.technical && s.technical.length > 0)
    }
  },
  {
    id: 'portfolio',
    label: 'Portfolio',
    description: 'Personal side-projects and open-source work (not work projects)',
    profileKey: 'portfolio',
    completionCheck: (profile) => {
      const p = profile.portfolio as unknown[]
      return Array.isArray(p) && p.length > 0
    }
  },
  {
    id: 'languages-soft-skills',
    label: 'Languages & Soft Skills',
    description: 'Languages spoken and interpersonal strengths',
    profileKey: 'languages',
    completionCheck: (profile) => {
      const l = profile.languages as unknown[]
      return Array.isArray(l) && l.length > 0
    }
  }
]

interface AppStore {
  profile: Record<string, unknown>
  setProfile: (profile: Record<string, unknown>) => void

  messages: ChatMessage[]
  addMessage: (message: ChatMessage) => void
  clearMessages: () => void

  isStreaming: boolean
  setStreaming: (streaming: boolean) => void
  streamingContent: string
  appendStreamChunk: (chunk: string) => void
  clearStreamChunk: () => void

  currentSection: WizardSection
  setCurrentSection: (section: WizardSection) => void

  // Per-section state for the profile overview cards
  sectionMessages: Record<string, ChatMessage[]>
  addSectionMessage: (sectionId: string, message: ChatMessage) => void

  sectionStreaming: Record<string, boolean>
  setSectionStreaming: (sectionId: string, value: boolean) => void

  sectionStreamContent: Record<string, string>
  appendSectionStreamChunk: (sectionId: string, chunk: string) => void
  clearSectionStreamChunk: (sectionId: string) => void

  expandedSectionId: string | null
  setExpandedSectionId: (id: string | null) => void

  initialisedSections: Record<string, true>
  markSectionInitialised: (sectionId: string) => void

  // Job Match state
  jobSessions: JobSession[]
  activeJobId: string | null
  createJobSession: () => string             // returns new id
  deleteJobSession: (id: string) => void
  setActiveJobId: (id: string | null) => void
  updateJobSession: (id: string, patch: Partial<JobSession>) => void

  // Page navigation (allows any page to navigate without prop drilling)
  page: AppPage
  setPage: (page: AppPage) => void
}

export const useStore = create<AppStore>()(persist((set) => ({
  profile: {},
  setProfile: (profile) => set({ profile }),

  messages: [],
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  clearMessages: () => set({ messages: [] }),

  isStreaming: false,
  setStreaming: (isStreaming) => set({ isStreaming }),
  streamingContent: '',
  appendStreamChunk: (chunk) => set((state) => ({ streamingContent: state.streamingContent + chunk })),
  clearStreamChunk: () => set({ streamingContent: '' }),

  currentSection: WIZARD_SECTIONS[0],
  setCurrentSection: (currentSection) => set({ currentSection, messages: [], streamingContent: '' }),

  // Per-section state
  sectionMessages: {},
  addSectionMessage: (sectionId, message) =>
    set((state) => ({
      sectionMessages: {
        ...state.sectionMessages,
        [sectionId]: [...(state.sectionMessages[sectionId] ?? []), message]
      }
    })),

  sectionStreaming: {},
  setSectionStreaming: (sectionId, value) =>
    set((state) => ({
      sectionStreaming: { ...state.sectionStreaming, [sectionId]: value }
    })),

  sectionStreamContent: {},
  appendSectionStreamChunk: (sectionId, chunk) =>
    set((state) => ({
      sectionStreamContent: {
        ...state.sectionStreamContent,
        [sectionId]: (state.sectionStreamContent[sectionId] ?? '') + chunk
      }
    })),
  clearSectionStreamChunk: (sectionId) =>
    set((state) => ({
      sectionStreamContent: { ...state.sectionStreamContent, [sectionId]: '' }
    })),

  expandedSectionId: null,
  setExpandedSectionId: (expandedSectionId) => set({ expandedSectionId }),

  initialisedSections: {},
  markSectionInitialised: (sectionId) =>
    set((state) => ({
      initialisedSections: { ...state.initialisedSections, [sectionId]: true }
    })),

  // Job Match state
  jobSessions: [],
  activeJobId: null,
  createJobSession: () => {
    const id = `job-${Date.now()}`
    const session: JobSession = {
      id,
      name: 'New job',
      jobText: '',
      analysis: null,
      analysing: false,
      cardIndex: 0,
      answered: [],
      skipped: [],
      answers: {},
      createdAt: Date.now(),
      generatedDocs: null,
      generating: false,
    }
    set((state) => ({ jobSessions: [...state.jobSessions, session], activeJobId: id }))
    return id
  },
  deleteJobSession: (id) =>
    set((state) => ({
      jobSessions: state.jobSessions.filter(j => j.id !== id),
      activeJobId: state.activeJobId === id
        ? (state.jobSessions.find(j => j.id !== id)?.id ?? null)
        : state.activeJobId
    })),
  setActiveJobId: (activeJobId) => set({ activeJobId }),
  updateJobSession: (id, patch) =>
    set((state) => ({
      jobSessions: state.jobSessions.map(j => j.id === id ? { ...j, ...patch } : j)
    })),

  page: 'intro',
  setPage: (page) => set({ page }),
}), {
  name: 'profile-builder-store',
  partialize: (state) => ({
    jobSessions: state.jobSessions,
    activeJobId: state.activeJobId,
  }),
  onRehydrateStorage: () => (state) => {
    // Clear any in-progress flags that would be stale after a restart
    if (state) {
      state.jobSessions = state.jobSessions.map(j => ({
        ...j,
        analysing: false,
        generating: false,
      }))
    }
  },
}))
