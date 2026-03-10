import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useStore, WizardSection } from '../store'
import ChatMessage, { formatAssistantContent } from './ChatMessage'

interface Props {
  section: WizardSection
  // If provided, sent as the opening message automatically.
  // Pass empty string '' to open chat without auto-sending anything.
  initialMessage?: string
}

export default function SectionChat({ section, initialMessage }: Props): React.JSX.Element {
  const {
    sectionMessages,
    addSectionMessage,
    sectionStreaming,
    setSectionStreaming,
    sectionStreamContent,
    appendSectionStreamChunk,
    clearSectionStreamChunk,
    markSectionInitialised,
    setProfile
  } = useStore()

  const messages = sectionMessages[section.id] ?? []
  const isStreaming = sectionStreaming[section.id] ?? false
  const streamingContent = sectionStreamContent[section.id] ?? ''

  const [inputValue, setInputValue] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  const sendMessage = useCallback(async (text: string, isSystemInit = false) => {
    if (!text.trim()) return

    if (!isSystemInit) {
      addSectionMessage(section.id, { role: 'user', content: text, timestamp: Date.now() })
    }

    setSectionStreaming(section.id, true)

    const api = (window as any).api
    const conversationHistory = useStore.getState().sectionMessages[section.id]?.map(m => ({
      role: m.role,
      content: m.content
    })) ?? []

    await api.chat.send({
      message: text,
      section: section.label,
      conversationHistory,
      profile: useStore.getState().profile
    })
  }, [section.id, section.label, addSectionMessage, setSectionStreaming])

  // Register IPC listeners on mount, clean up on unmount
  useEffect(() => {
    const api = (window as any).api
    if (!api?.chat) return

    const removeStream = api.chat.onStream((chunk: string) => {
      appendSectionStreamChunk(section.id, chunk)
    })

    const removeDone = api.chat.onDone((payload: any) => {
      setSectionStreaming(section.id, false)
      clearSectionStreamChunk(section.id)
      addSectionMessage(section.id, {
        role: 'assistant',
        content: payload.agentResponse.message,
        timestamp: Date.now()
      })
      if (payload.updatedProfile) {
        setProfile(payload.updatedProfile)
      }
    })

    const removeError = api.chat.onError((payload: any) => {
      setSectionStreaming(section.id, false)
      clearSectionStreamChunk(section.id)
      addSectionMessage(section.id, {
        role: 'assistant',
        content: `Error: ${payload.error}`,
        timestamp: Date.now()
      })
    })

    return () => {
      removeStream()
      removeDone()
      removeError()
    }
  }, [section.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-send the opening message once on mount.
  // useRef guard prevents double-fire in React strict mode / fast-refresh.
  const startedRef = useRef(false)
  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    if (initialMessage !== undefined) {
      // Explicit question chosen from chips (or '' = free-type mode, don't send)
      if (initialMessage === '') return
      // Show the question as a visible user message, then send it to the AI
      addSectionMessage(section.id, { role: 'user', content: initialMessage, timestamp: Date.now() })
      sendMessage(initialMessage, true)
    } else {
      // Generic section open — only fire once per section per session
      if (useStore.getState().initialisedSections[section.id]) return
      markSectionInitialised(section.id)
      const openingMessage = `Let's work on the ${section.label} section. ${section.description}. Please start the interview for this section.`
      sendMessage(openingMessage, true)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSend = () => {
    const text = inputValue.trim()
    if (!text || isStreaming) return
    setInputValue('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    sendMessage(text)
  }

  return (
    <div className="flex flex-col" style={{ maxHeight: '440px' }}>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0" style={{ minHeight: '120px' }}>
        {messages.map((msg, i) => (
          <ChatMessage key={i} message={msg} />
        ))}

        {isStreaming && (
          <div className="flex justify-start mb-4">
            <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold mr-3 flex-shrink-0 mt-0.5">
              AI
            </div>
            <div className="max-w-[75%] rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100">
              {streamingContent?.trimStart() ? (
                <div>{formatAssistantContent(streamingContent.trimStart())}</div>
              ) : (
                <span className="flex gap-1 items-center py-1">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
              )}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-800 flex-shrink-0">
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            onInput={(e) => {
              const el = e.currentTarget
              el.style.height = 'auto'
              el.style.height = Math.min(el.scrollHeight, 120) + 'px'
            }}
            disabled={isStreaming}
            placeholder={isStreaming ? 'Claude is responding...' : 'Reply… (Enter to send, Shift+Enter for newline)'}
            rows={1}
            className="flex-1 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 resize-none focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ minHeight: '44px', maxHeight: '120px' }}
          />
          <button
            onClick={handleSend}
            disabled={isStreaming || !inputValue.trim()}
            className="px-4 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium transition-colors flex-shrink-0"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
