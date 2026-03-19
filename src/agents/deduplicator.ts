import Anthropic from '@anthropic-ai/sdk'

const REQUEST_TIMEOUT_MS = 90_000

async function withTimeout<T>(promise: Promise<T>, ms: number, errorMessage: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(errorMessage)), ms)
  })

  try {
    return await Promise.race([promise, timeoutPromise])
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

const SYSTEM_PROMPT = `You are a profile data merging specialist. You will be given two versions of profile data:
1. The EXISTING profile (already saved)
2. NEWLY EXTRACTED data (from an imported document)

Your job is to produce a single merged result for each array/object section. Rules:
- If the same entity appears in both (same job, same degree, same project etc.) merge them into ONE entry
- When both have a value for the same field, prefer the more detailed or more recent version
- When one has a value and the other doesn't, keep the value that exists
- For array sub-fields (achievements, technologies), combine and deduplicate
- For string arrays (softSkills, skills.technical etc.), combine and deduplicate case-insensitively
- Never duplicate an entry — use semantic matching, not just exact string matching
- Return only sections where there is something to merge (omit sections where extracted is empty)

Call the merge_profile tool with the final merged result.`

const MERGE_PROFILE_TOOL: Anthropic.Tool = {
  name: 'merge_profile',
  description: 'Output the deduplicated, merged profile sections.',
  input_schema: {
    type: 'object' as const,
    properties: {
      workExperience: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            company: { type: 'string' },
            title: { type: 'string' },
            startDate: { type: 'string' },
            endDate: { type: 'string' },
            location: { type: 'string' },
            current: { type: 'boolean' },
            description: { type: 'string' },
            achievements: { type: 'array', items: { type: 'string' } },
            technologies: { type: 'array', items: { type: 'string' } }
          }
        }
      },
      education: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            institution: { type: 'string' },
            degree: { type: 'string' },
            field: { type: 'string' },
            startDate: { type: 'string' },
            endDate: { type: 'string' },
            grade: { type: 'string' },
            achievements: { type: 'array', items: { type: 'string' } }
          }
        }
      },
      certifications: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            issuer: { type: 'string' },
            date: { type: 'string' },
            credentialId: { type: 'string' },
            url: { type: 'string' }
          }
        }
      },
      skills: {
        type: 'object',
        properties: {
          technical: { type: 'array', items: { type: 'string' } },
          domains: { type: 'array', items: { type: 'string' } },
          tools: { type: 'array', items: { type: 'string' } }
        }
      },
      portfolio: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            technologies: { type: 'array', items: { type: 'string' } },
            url: { type: 'string' },
            githubUrl: { type: 'string' },
            websiteUrl: { type: 'string' },
            highlights: { type: 'array', items: { type: 'string' } }
          }
        }
      },
      languages: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            language: { type: 'string' },
            proficiency: { type: 'string' }
          }
        }
      },
      softSkills: {
        type: 'array',
        items: { type: 'string' }
      },
      personal: {
        type: 'object',
        properties: {
          fullName: { type: 'string' },
          email: { type: 'string' },
          phone: { type: 'string' },
          location: { type: 'string' },
          website: { type: 'string' },
          linkedin: { type: 'string' },
          github: { type: 'string' }
        }
      },
      summary: {
        type: 'object',
        properties: {
          default: { type: 'string' },
          variants: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                label: { type: 'string' },
                content: { type: 'string' }
              }
            }
          }
        }
      }
    }
  }
}

const CLEAN_SYSTEM_PROMPT = `You are a profile data cleaning specialist. You will be given a profile JSON that may contain duplicate or near-duplicate entries caused by multiple imports.

Your job is to deduplicate it in place:
- Identify entries that refer to the same entity (same job, same degree, same project, same skill etc.) even if the text differs slightly
- Merge duplicates into a single entry, keeping the most detailed/complete version of each field
- For array sub-fields (achievements, technologies), combine and deduplicate
- For string arrays (softSkills, skills.*), deduplicate case-insensitively, preserving the best-cased version
- Do not remove any genuine distinct entries
- Return the full cleaned profile using the clean_profile tool`

const CLEAN_PROFILE_TOOL: Anthropic.Tool = {
  name: 'clean_profile',
  description: 'Output the deduplicated, cleaned profile.',
  input_schema: MERGE_PROFILE_TOOL.input_schema
}

export async function cleanProfile(
  profile: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set.')

  const client = new Anthropic({ apiKey })

  const response = await withTimeout(
    client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      system: CLEAN_SYSTEM_PROMPT,
      tools: [CLEAN_PROFILE_TOOL],
      tool_choice: { type: 'any' },
      messages: [{ role: 'user', content: `PROFILE TO CLEAN:\n${JSON.stringify(profile, null, 2)}` }]
    }),
    REQUEST_TIMEOUT_MS,
    'Deduplication timed out after 90 seconds. Please try again.'
  )

  for (const block of response.content) {
    if (block.type === 'tool_use' && block.name === 'clean_profile') {
      const cleaned = block.input as Record<string, unknown>
      // Preserve any top-level keys not covered by the tool schema (e.g. meta, extras)
      return { ...profile, ...cleaned }
    }
  }

  return profile
}

// Keys handled by the LLM dedup (need semantic matching)
const LLM_MERGE_KEYS = [
  'workExperience', 'education', 'certifications', 'skills',
  'languages', 'softSkills', 'personal', 'summary'
]

export async function deduplicateProfile(
  existing: Record<string, unknown>,
  extracted: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set.')

  let result: Record<string, unknown> = { ...existing }

  // If only one side has portfolio data, no dedup needed — just use whichever exists
  const existingPortfolio = Array.isArray(existing.portfolio) ? existing.portfolio : []
  const extractedPortfolio = Array.isArray(extracted.portfolio) ? extracted.portfolio : []
  const needsPortfolioLLM = existingPortfolio.length > 0 && extractedPortfolio.length > 0

  // If only one side has portfolio data, merge without LLM
  if (!needsPortfolioLLM && extractedPortfolio.length > 0) {
    result.portfolio = [...existingPortfolio, ...extractedPortfolio]
  }

  // Only send sections where extracted actually has data to the LLM
  const existingSubset: Record<string, unknown> = {}
  const extractedSubset: Record<string, unknown> = {}

  for (const key of LLM_MERGE_KEYS) {
    const ext = extracted[key]
    if (ext === null || ext === undefined) continue
    if (Array.isArray(ext) && ext.length === 0) continue
    if (typeof ext === 'object' && !Array.isArray(ext) && Object.keys(ext as object).length === 0) continue
    existingSubset[key] = existing[key] ?? (Array.isArray(ext) ? [] : {})
    extractedSubset[key] = ext
  }

  // Include portfolio in LLM merge when both sides have entries (names may differ)
  if (needsPortfolioLLM) {
    existingSubset.portfolio = existingPortfolio
    extractedSubset.portfolio = extractedPortfolio
  }

  // Nothing left for LLM — return early
  if (Object.keys(extractedSubset).length === 0) {
    return result
  }

  const client = new Anthropic({ apiKey })

  const userMessage = `EXISTING PROFILE DATA:\n${JSON.stringify(existingSubset, null, 2)}\n\nNEWLY EXTRACTED DATA:\n${JSON.stringify(extractedSubset, null, 2)}`

  const response = await withTimeout(
    client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      tools: [MERGE_PROFILE_TOOL],
      tool_choice: { type: 'any' },
      messages: [{ role: 'user', content: userMessage }]
    }),
    REQUEST_TIMEOUT_MS,
    'Profile merge timed out after 90 seconds. Please try importing again.'
  )

  for (const block of response.content) {
    if (block.type === 'tool_use' && block.name === 'merge_profile') {
      const merged = block.input as Record<string, unknown>
      for (const [k, v] of Object.entries(merged)) {
        if (v !== null && v !== undefined) result[k] = v
      }
      // Scalar top-level fields not handled by LLM (e.g. future keys)
      for (const [k, v] of Object.entries(extracted)) {
        if (!LLM_MERGE_KEYS.includes(k) && k !== 'portfolio' && v !== null && v !== undefined && !result[k]) {
          result[k] = v
        }
      }
      return result
    }
  }

  // Fallback: LLM call failed, return what we have (portfolio already handled above)
  return result
}
