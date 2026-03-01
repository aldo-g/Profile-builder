import Anthropic from '@anthropic-ai/sdk'

const SYSTEM_PROMPT = `You are a career data extraction specialist. You will be given raw text from a CV/résumé and/or a LinkedIn profile URL, and you must extract as much structured professional data as possible.

Extract everything you can find:
- Full name, email, phone, location, website, LinkedIn URL
- Every work experience entry: company, title, dates, location, description, achievements, technologies used
- Every education entry: institution, degree, field, dates, grade/GPA if present
- All certifications: name, issuer, date, credential ID if present
- Technical skills, tools, domains, programming languages
- Portfolio projects: name, description, technologies, links, outcomes
- Languages spoken and proficiency levels
- Soft skills and competencies mentioned

Be exhaustive. Do not summarise or paraphrase — preserve specific details, dates, company names, numbers, and metrics exactly as written.

Call the extract_profile tool with everything you find. If a field is not present, omit it rather than guessing.`

const EXTRACT_PROFILE_TOOL: Anthropic.Tool = {
  name: 'extract_profile',
  description: 'Save all extracted profile data from the imported documents.',
  input_schema: {
    type: 'object' as const,
    properties: {
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
          variants: { type: 'array', items: { type: 'string' } }
        }
      },
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
      }
    },
    required: ['personal']
  }
}

export interface ImporterInput {
  cvText?: string
  linkedinText?: string
  linkedinUrl?: string
}

export async function runImporter(input: ImporterInput): Promise<Record<string, unknown>> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set.')
  }

  const client = new Anthropic({ apiKey })

  const parts: string[] = []
  if (input.cvText) {
    parts.push(`=== CV / RÉSUMÉ TEXT ===\n\n${input.cvText}`)
  }
  if (input.linkedinUrl) {
    parts.push(`=== LINKEDIN PROFILE URL ===\n\n${input.linkedinUrl}\n\n(Store this under personal.linkedin)`)
  }
  if (input.linkedinText) {
    parts.push(`=== LINKEDIN EXPORT DATA ===\n\n${input.linkedinText}`)
  }

  if (parts.length === 0) {
    return {}
  }

  const userMessage = parts.join('\n\n---\n\n')

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    tools: [EXTRACT_PROFILE_TOOL],
    tool_choice: { type: 'any' },
    messages: [{ role: 'user', content: userMessage }]
  })

  for (const block of response.content) {
    if (block.type === 'tool_use' && block.name === 'extract_profile') {
      return block.input as Record<string, unknown>
    }
  }

  return {}
}
