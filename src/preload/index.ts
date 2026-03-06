import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  profile: {
    read: () => ipcRenderer.invoke('profile:read'),
    write: (data: object) => ipcRenderer.invoke('profile:write', data),
    reset: () => ipcRenderer.invoke('profile:reset'),
    export: () => ipcRenderer.invoke('profile:export'),
    dedupe: () => ipcRenderer.invoke('profile:dedupe')
  },
  imports: {
    baseline: (payload: { cvPath?: string; linkedinZipPath?: string; rawText?: string }) =>
      ipcRenderer.invoke('import:baseline', payload),
    linkedInOAuth: () => ipcRenderer.invoke('linkedin:oauth')
  },
  questions: {
    generate: (payload: { section: string; profile: object }) =>
      ipcRenderer.invoke('questions:generate', payload)
  },
  chat: {
    send: (payload: {
      message: string
      section: string
      conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
      profile: object
    }) => ipcRenderer.invoke('chat:send', payload),

    onStream: (callback: (chunk: string) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, chunk: string) => callback(chunk)
      ipcRenderer.on('chat:stream', listener)
      return () => ipcRenderer.removeListener('chat:stream', listener)
    },

    onDone: (callback: (payload: { agentResponse: unknown; updatedProfile: unknown }) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: unknown) => callback(payload as { agentResponse: unknown; updatedProfile: unknown })
      ipcRenderer.on('chat:done', listener)
      return () => ipcRenderer.removeListener('chat:done', listener)
    },

    onError: (callback: (payload: { error: string }) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: unknown) => callback(payload as { error: string })
      ipcRenderer.on('chat:error', listener)
      return () => ipcRenderer.removeListener('chat:error', listener)
    }
  },
  job: {
    analyse: (payload: { jobText: string; profile: object }) =>
      ipcRenderer.invoke('job:analyse', payload),

    chat: (payload: {
      message: string
      conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
      jobText: string
      analysis: object
      profile: object
    }) => ipcRenderer.invoke('job:chat', payload),

    onStream: (callback: (chunk: string) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, chunk: string) => callback(chunk)
      ipcRenderer.on('job:stream', listener)
      return () => ipcRenderer.removeListener('job:stream', listener)
    },

    onDone: (callback: (payload: { agentResponse: unknown; updatedProfile: unknown }) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: unknown) => callback(payload as { agentResponse: unknown; updatedProfile: unknown })
      ipcRenderer.on('job:done', listener)
      return () => ipcRenderer.removeListener('job:done', listener)
    },

    onError: (callback: (payload: { error: string }) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: unknown) => callback(payload as { error: string })
      ipcRenderer.on('job:error', listener)
      return () => ipcRenderer.removeListener('job:error', listener)
    }
  },

  templates: {
    save: (payload: { filePath: string; type: 'cv' | 'coverLetter' }) =>
      ipcRenderer.invoke('template:save', payload),
    check: (): Promise<{ cv: boolean; coverLetter: boolean }> =>
      ipcRenderer.invoke('template:check'),
    read: (payload: { type: 'cv' | 'coverLetter' }): Promise<{ text: string }> =>
      ipcRenderer.invoke('template:read', payload)
  },

  generate: {
    docs: (payload: {
      profile: object
      analysis: object
      cvTemplateText: string
      coverLetterTemplateText?: string
    }) => ipcRenderer.invoke('generate:docs', payload),

    pdf: (payload: { markdown: string; filename: string }) =>
      ipcRenderer.invoke('generate:pdf', payload),

    docx: (payload: { markdown: string; filename: string }) =>
      ipcRenderer.invoke('generate:docx', payload),

    onStream: (callback: (chunk: string) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, chunk: string) => callback(chunk)
      ipcRenderer.on('generate:stream', listener)
      return () => ipcRenderer.removeListener('generate:stream', listener)
    },

    onDone: (callback: (result: unknown) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, result: unknown) => callback(result)
      ipcRenderer.on('generate:done', listener)
      return () => ipcRenderer.removeListener('generate:done', listener)
    },

    onError: (callback: (payload: { error: string }) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: unknown) =>
        callback(payload as { error: string })
      ipcRenderer.on('generate:error', listener)
      return () => ipcRenderer.removeListener('generate:error', listener)
    }
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore
  window.electron = electronAPI
  // @ts-ignore
  window.api = api
}
