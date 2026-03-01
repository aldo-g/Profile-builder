import AdmZip from 'adm-zip'

// Minimal CSV parser — handles quoted fields with commas/newlines inside
function parseCsv(text: string): Record<string, string>[] {
  const lines: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (current.trim()) lines.push(current)
      current = ''
      if (ch === '\r' && text[i + 1] === '\n') i++
    } else {
      current += ch
    }
  }
  if (current.trim()) lines.push(current)

  if (lines.length < 2) return []

  const headers = splitCsvLine(lines[0])
  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line)
    const row: Record<string, string> = {}
    headers.forEach((h, i) => {
      row[h.trim()] = (values[i] ?? '').trim()
    })
    return row
  })
}

function splitCsvLine(line: string): string[] {
  const fields: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        field += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(field)
      field = ''
    } else {
      field += ch
    }
  }
  fields.push(field)
  return fields
}

function readCsv(zip: AdmZip, filename: string): Record<string, string>[] {
  // LinkedIn ZIP may have files at root or inside a folder
  const entries = zip.getEntries()
  const entry = entries.find(
    (e) => e.name.toLowerCase() === filename.toLowerCase() ||
           e.entryName.toLowerCase().endsWith('/' + filename.toLowerCase())
  )
  if (!entry) return []
  const text = entry.getData().toString('utf-8')
  return parseCsv(text)
}

export interface LinkedInData {
  profile: Record<string, string>[]
  positions: Record<string, string>[]
  education: Record<string, string>[]
  skills: Record<string, string>[]
  certifications: Record<string, string>[]
  languages: Record<string, string>[]
  projects: Record<string, string>[]
  courses: Record<string, string>[]
}

export function parseLinkedInZip(zipPath: string): LinkedInData {
  const zip = new AdmZip(zipPath)

  return {
    profile: readCsv(zip, 'Profile.csv'),
    positions: readCsv(zip, 'Positions.csv'),
    education: readCsv(zip, 'Education.csv'),
    skills: readCsv(zip, 'Skills.csv'),
    certifications: readCsv(zip, 'Certifications.csv'),
    languages: readCsv(zip, 'Languages.csv'),
    projects: readCsv(zip, 'Projects.csv'),
    courses: readCsv(zip, 'Courses.csv'),
  }
}

// Serialise the parsed data into a compact text block for Claude
export function linkedInDataToText(data: LinkedInData): string {
  const sections: string[] = []

  function tableToText(label: string, rows: Record<string, string>[]): void {
    if (!rows.length) return
    sections.push(`=== ${label} ===\n${JSON.stringify(rows, null, 2)}`)
  }

  tableToText('PROFILE', data.profile)
  tableToText('POSITIONS / WORK EXPERIENCE', data.positions)
  tableToText('EDUCATION', data.education)
  tableToText('SKILLS', data.skills)
  tableToText('CERTIFICATIONS', data.certifications)
  tableToText('LANGUAGES', data.languages)
  tableToText('PROJECTS', data.projects)
  tableToText('COURSES', data.courses)

  return sections.join('\n\n')
}
