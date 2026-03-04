import React, { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import ChatMessage, { formatAssistantContent } from '../components/ChatMessage'

export default function JobMatchPage(): React.JSX.Element {
  const {
    profile,
    setProfile,
    jobText,
    setJobText,
    jobAnalysis,
    setJobAnalysis,
    jobMessages,
    addJobMessage,
    clearJobMessages,
    jobStreaming,
    setJobStreaming,
    jobStreamContent,
    appendJobStreamChunk,
    clearJobStreamContent,
    jobAnalysing,
    setJobAnalysing
  } = useStore()

  const phase = jobAnalysing ? 'analysing' : jobAnalysis ? 'done' : 'idle'
  const [inputValue, setInputValue] = useState('')
  const [analyseError, setAnalyseError] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const startedRef = useRef(false)

  // Register job:* IPC listeners on mount, clean up on unmount
  useEffect(() => {
    const api = (window as any).api
    if (!api?.job) return

    const removeStream = api.job.onStream((chunk: string) => {
      appendJobStreamChunk(chunk)
    })

    const removeDone = api.job.onDone((payload: any) => {
      setJobStreaming(false)
      clearJobStreamContent()
      addJobMessage({
        role: 'assistant',
        content: payload.agentResponse.message,
        timestamp: Date.now()
      })
      if (payload.updatedProfile) {
        setProfile(payload.updatedProfile)
      }
    })

    const removeError = api.job.onError((payload: any) => {
      setJobStreaming(false)
      clearJobStreamContent()
      addJobMessage({
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

  // Auto-scroll on new messages / streaming content
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [jobMessages, jobStreamContent])

  // After analysis completes, send a hidden init message so Claude generates real follow-up questions
  useEffect(() => {
    if (phase !== 'done') return
    if (startedRef.current) return
    if (jobMessages.length > 0) {
      startedRef.current = true
      return
    }
    startedRef.current = true
    const state = useStore.getState()
    if (!state.jobAnalysis) return
    setJobStreaming(true)
    const api = (window as any).api
    api.job.chat({
      message: 'Please start by summarising the key gaps and asking me your first targeted follow-up question.',
      conversationHistory: [],
      jobText: state.jobText,
      analysis: state.jobAnalysis,
      profile: state.profile
    })
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAnalyse(): Promise<void> {
    const trimmed = jobText.trim()
    if (!trimmed) return
    setAnalyseError('')
    setJobAnalysing(true)
    clearJobMessages()
    setJobAnalysis(null)
    setJobOpeningMessage('')
    startedRef.current = false
    try {
      const api = (window as any).api
      const result = await api.job.analyse({
        jobText: trimmed,
        profile: useStore.getState().profile
      })
      setJobAnalysis(result.analysis)
      setJobOpeningMessage(result.openingMessage)
    } catch (err: unknown) {
      setAnalyseError(err instanceof Error ? err.message : 'Analysis failed. Please try again.')
    } finally {
      setJobAnalysing(false)
    }
  }

  async function handleSend(): Promise<void> {
    const text = inputValue.trim()
    if (!text || jobStreaming) return
    setInputValue('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    addJobMessage({ role: 'user', content: text, timestamp: Date.now() })
    setJobStreaming(true)
    const api = (window as any).api
    const state = useStore.getState()
    await api.job.chat({
      message: text,
      conversationHistory: state.jobMessages.map((m) => ({ role: m.role, content: m.content })),
      jobText: state.jobText,
      analysis: state.jobAnalysis,
      profile: state.profile
    })
  }

  function handleReset(): void {
    setJobAnalysis(null)
    clearJobMessages()
    setJobOpeningMessage('')
    clearJobStreamContent()
    startedRef.current = false
    setAnalyseError('')
  }

  if (phase === 'idle' || phase === 'analysing') {
    return (
      <div className="flex items-start justify-center h-full overflow-y-auto">
        <div className="w-full max-w-2xl px-8 py-12">
          <h2 className="text-xl font-semibold text-white mb-1">Job Match</h2>
          <p className="text-sm text-gray-400 mb-6">
            Paste a job listing below. Claude will score your fit and ask targeted questions to strengthen your application.
          </p>
          <textarea
            value={jobText}
            onChange={(e) => setJobText(e.target.value)}
            disabled={phase === 'analysing'}
            placeholder="Paste the full job listing here…"
            rows={14}
            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          {analyseError && (
            <p className="mt-2 text-xs text-red-400">{analyseError}</p>
          )}
          <div className="mt-4 flex justify-end">
            <button
              onClick={handleAnalyse}
              disabled={phase === 'analysing' || !jobText.trim()}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
            >
              {phase === 'analysing' ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Analysing…
                </>
              ) : (
                'Analyse job listing'
              )}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Done phase: two-column layout
  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: gap analysis sidebar */}
      <aside className="w-80 flex-shrink-0 border-r border-gray-800 overflow-y-auto">
        <div className="px-5 py-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Gap Analysis</h3>
            <button
              onClick={handleReset}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              Re-analyse
            </button>
          </div>

          <FitScoreBadge score={jobAnalysis!.score} />

          <SidebarSection title="Missing Skills" emptyText="None identified">
            <div className="flex flex-wrap gap-1.5 mt-2">
              {jobAnalysis!.missingSkills.map((skill, i) => (
                <span key={i} className="text-xs bg-gray-800 border border-gray-700 rounded-full px-2.5 py-1 text-gray-300">
                  {skill}
                </span>
              ))}
            </div>
          </SidebarSection>

          <SidebarSection title="Experience to Highlight" emptyText="None identified">
            <ul className="mt-2 space-y-1">
              {jobAnalysis!.highlightExperience.map((item, i) => (
                <li key={i} className="text-xs text-gray-300 flex gap-2">
                  <span className="text-green-500 flex-shrink-0 mt-0.5">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </SidebarSection>

          <SidebarSection title="Gaps" emptyText="No significant gaps">
            <ul className="mt-2 space-y-1">
              {jobAnalysis!.gaps.map((gap, i) => (
                <li key={i} className="text-xs text-gray-300 flex gap-2">
                  <span className="text-yellow-500 flex-shrink-0 mt-0.5">!</span>
                  {gap}
                </li>
              ))}
            </ul>
          </SidebarSection>

          <SidebarSection title="Recommended Tweaks" emptyText="None">
            <ul className="mt-2 space-y-1">
              {jobAnalysis!.recommendedTweaks.map((tweak, i) => (
                <li key={i} className="text-xs text-gray-300 flex gap-2">
                  <span className="text-blue-400 flex-shrink-0 mt-0.5">→</span>
                  {tweak}
                </li>
              ))}
            </ul>
          </SidebarSection>
        </div>
      </aside>

      {/* Right: job chat pane */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="px-5 py-3 border-b border-gray-800 flex-shrink-0">
          <p className="text-xs font-medium text-white">Follow-up Chat</p>
          <p className="text-xs text-gray-500">Claude will ask targeted questions to fill the gaps</p>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0">
          {jobMessages.map((msg, i) => (
            <ChatMessage key={i} message={msg} />
          ))}

          {jobStreaming && (
            <div className="flex justify-start mb-4">
              <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold mr-3 flex-shrink-0 mt-0.5">
                AI
              </div>
              <div className="max-w-[75%] rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed bg-gray-800 text-gray-100">
                {jobStreamContent?.trimStart() ? (
                  <div>{formatAssistantContent(jobStreamContent.trimStart())}</div>
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
        <div className="px-5 py-3 border-t border-gray-800 flex-shrink-0">
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
              disabled={jobStreaming}
              placeholder={jobStreaming ? 'Claude is responding…' : 'Reply… (Enter to send, Shift+Enter for newline)'}
              rows={1}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ minHeight: '44px', maxHeight: '120px' }}
            />
            <button
              onClick={handleSend}
              disabled={jobStreaming || !inputValue.trim()}
              className="px-4 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium transition-colors flex-shrink-0"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function FitScoreBadge({ score }: { score: number }): React.JSX.Element {
  const colour =
    score >= 70
      ? 'text-green-400 bg-green-400/10 border-green-700/40'
      : score >= 40
        ? 'text-yellow-400 bg-yellow-400/10 border-yellow-700/40'
        : 'text-red-400 bg-red-400/10 border-red-700/40'

  const label = score >= 70 ? 'Strong match' : score >= 40 ? 'Partial match' : 'Weak match'

  return (
    <div className={`rounded-xl border px-4 py-3 mb-4 flex items-center justify-between ${colour}`}>
      <span className="text-xs font-medium">{label}</span>
      <span className="text-2xl font-bold">{score}<span className="text-sm font-normal opacity-60">/100</span></span>
    </div>
  )
}

function SidebarSection({
  title,
  emptyText,
  children
}: {
  title: string
  emptyText: string
  children: React.ReactNode
}): React.JSX.Element {
  // Determine if children contain any items by checking the analysis
  return (
    <div className="mb-4">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{title}</p>
      {children ?? <p className="text-xs text-gray-600 mt-2">{emptyText}</p>}
    </div>
  )
}

