import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  profile: {
    read: () => ipcRenderer.invoke('profile:read'),
    write: (data: object) => ipcRenderer.invoke('profile:write', data),
    reset: () => ipcRenderer.invoke('profile:reset')
  },
  imports: {
    baseline: (payload: { cvPath?: string; linkedinZipPath?: string }) =>
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
