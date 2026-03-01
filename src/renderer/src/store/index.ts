import { create } from 'zustand'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export interface WizardSection {
  id: string
  label: string
  description: string
  profileKey: string | null
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
    description: 'Projects, open source, and public work',
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
  },
  {
    id: 'import',
    label: 'Import documents',
    description: 'Add CVs, LinkedIn exports, or certificates to enrich your profile',
    profileKey: null,
    completionCheck: () => false
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
}

export const useStore = create<AppStore>((set) => ({
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
}))
