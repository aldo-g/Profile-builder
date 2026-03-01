import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useStore } from '../store'
import ChatMessage, { formatAssistantContent } from './ChatMessage'

export default function ChatPane(): React.JSX.Element {
  const {
    messages,
    addMessage,
    isStreaming,
    setStreaming,
    streamingContent,
    appendStreamChunk,
    clearStreamChunk,
    currentSection,
    profile,
    setProfile
  } = useStore()

  const [inputValue, setInputValue] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const sectionInitialisedRef = useRef<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom on new content
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  // Define sendMessage before any effect that uses it
  const sendMessage = useCallback(async (text: string, isSystemInit = false) => {
    if (!text.trim()) return

    if (!isSystemInit) {
      addMessage({ role: 'user', content: text, timestamp: Date.now() })
    }

    setStreaming(true)

    const api = (window as any).api
    const conversationHistory = useStore.getState().messages.map(m => ({
      role: m.role,
      content: m.content
    }))

    await api.chat.send({
      message: text,
      section: currentSection.label,
      conversationHistory,
      profile
    })
  }, [currentSection, profile, addMessage, setStreaming])

  // Register IPC listeners once on mount — Zustand actions are stable refs
  useEffect(() => {
    const api = (window as any).api
    if (!api?.chat) return

    const removeStream = api.chat.onStream((chunk: string) => {
      appendStreamChunk(chunk)
    })

    const removeDone = api.chat.onDone((payload: any) => {
      setStreaming(false)
      clearStreamChunk()
      addMessage({
        role: 'assistant',
        content: payload.agentResponse.message,
        timestamp: Date.now()
      })
      if (payload.updatedProfile) {
        setProfile(payload.updatedProfile)
      }
    })

    const removeError = api.chat.onError((payload: any) => {
      setStreaming(false)
      clearStreamChunk()
      addMessage({
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
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-start interview when section first activates
  useEffect(() => {
    if (sectionInitialisedRef.current === currentSection.id) return
    sectionInitialisedRef.current = currentSection.id

    const startMessage = `Let's work on the ${currentSection.label} section. ${currentSection.description}. Please start the interview for this section.`
    sendMessage(startMessage, true)
  }, [currentSection.id, sendMessage])

  const handleSend = () => {
    const text = inputValue.trim()
    if (!text || isStreaming) return
    setInputValue('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
    sendMessage(text)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleTextareaInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }

  return (
    <div className="flex flex-col h-full">
      {/* Section header */}
      <div className="px-6 py-4 border-b border-gray-800 flex-shrink-0">
        <h2 className="text-base font-semibold text-white">{currentSection.label}</h2>
        <p className="text-sm text-gray-400 mt-0.5">{currentSection.description}</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {messages.map((message, index) => (
          <ChatMessage key={index} message={message} />
        ))}

        {/* Streaming bubble */}
        {isStreaming && (
          <div className="flex justify-start mb-4">
            <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold mr-3 flex-shrink-0 mt-0.5">
              AI
            </div>
            <div className="max-w-[75%] rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed bg-gray-800 text-gray-100">
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

      {/* Input area */}
      <div className="px-6 py-4 border-t border-gray-800 flex-shrink-0">
        <div className="flex gap-3 items-end">
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleTextareaInput}
            disabled={isStreaming}
            placeholder={isStreaming ? 'Claude is responding...' : 'Type your message… (Enter to send, Shift+Enter for newline)'}
            rows={1}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ minHeight: '48px', maxHeight: '120px' }}
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
