import React from 'react'
import { WizardSection } from '../store'

interface Props {
  section: WizardSection
  profile: Record<string, unknown>
  detail?: boolean
}

function EmptyPreview(): React.JSX.Element {
  return <p className="text-xs text-gray-600 italic">No data yet — expand to start</p>
}

export function SectionPreview({ section, profile, detail = false }: Props): React.JSX.Element {
  switch (section.id) {
    case 'personal': {
      const p = profile.personal as Record<string, any> | undefined
      if (!p?.fullName && !p?.email) return <EmptyPreview />

      if (detail) {
        return (
          <div className="space-y-2 text-sm text-gray-300">
            {p?.fullName && (
              <div><span className="text-gray-500 text-xs">Name</span><p className="text-white font-medium">{p.fullName}</p></div>
            )}
            {p?.preferredName && (
              <div><span className="text-gray-500 text-xs">Preferred name</span><p>{p.preferredName}</p></div>
            )}
            {p?.email && (
              <div><span className="text-gray-500 text-xs">Email</span><p>{p.email}</p></div>
            )}
            {p?.phone && (
              <div><span className="text-gray-500 text-xs">Phone</span><p>{p.phone}</p></div>
            )}
            {(p?.location?.city || p?.location?.country) && (
              <div>
                <span className="text-gray-500 text-xs">Location</span>
                <p>{[p.location.city, p.location.country].filter(Boolean).join(', ')}</p>
              </div>
            )}
            {(p?.links?.linkedin || p?.links?.github || p?.links?.portfolio) && (
              <div>
                <span className="text-gray-500 text-xs">Links</span>
                <div className="flex flex-wrap gap-2 mt-1">
                  {p.links.linkedin && <span className="text-blue-400 text-xs">LinkedIn</span>}
                  {p.links.github && <span className="text-blue-400 text-xs">GitHub</span>}
                  {p.links.portfolio && <span className="text-blue-400 text-xs">Portfolio</span>}
                </div>
              </div>
            )}
          </div>
        )
      }

      return (
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {p?.fullName && <span className="text-sm text-gray-200 font-medium">{p.fullName}</span>}
          {p?.email && <span className="text-xs text-gray-400">{p.email}</span>}
          {p?.location?.city && (
            <span className="text-xs text-gray-400">
              {[p.location.city, p.location.country].filter(Boolean).join(', ')}
            </span>
          )}
          {p?.links?.linkedin && <span className="text-xs text-blue-400">LinkedIn</span>}
          {p?.links?.github && <span className="text-xs text-blue-400">GitHub</span>}
        </div>
      )
    }

    case 'work-experience': {
      const jobs = (profile.workExperience as any[]) ?? []
      if (!jobs.length) return <EmptyPreview />

      if (detail) {
        return (
          <div className="space-y-4">
            {jobs.map((j: any, i: number) => (
              <div key={i} className="border-l-2 border-gray-700 pl-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-white">{j.title}</p>
                    {j.company && <p className="text-xs text-gray-400">{j.company}</p>}
                  </div>
                  <div className="text-right flex-shrink-0">
                    {j.current ? (
                      <span className="text-[10px] text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded-full">Current</span>
                    ) : (
                      <span className="text-xs text-gray-500">
                        {j.startDate}{j.endDate ? ` – ${j.endDate}` : ''}
                      </span>
                    )}
                  </div>
                </div>
                {j.summary && <p className="text-xs text-gray-400 mt-1 leading-relaxed">{j.summary}</p>}
                {Array.isArray(j.achievements) && j.achievements.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {j.achievements.map((a: string, ai: number) => (
                      <li key={ai} className="text-xs text-gray-400 flex gap-2">
                        <span className="text-gray-600 flex-shrink-0">•</span>{a}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )
      }

      const shown = jobs.slice(0, 3)
      return (
        <div className="space-y-1">
          {shown.map((j: any, i: number) => (
            <p key={i} className="text-xs text-gray-400">
              <span className="text-gray-200">{j.title}</span>
              {j.company && <span> at {j.company}</span>}
              {j.current && <span className="ml-2 text-blue-400 text-[10px]">Current</span>}
            </p>
          ))}
          {jobs.length > 3 && <p className="text-xs text-gray-600">+{jobs.length - 3} more</p>}
        </div>
      )
    }

    case 'education': {
      const edu = (profile.education as any[]) ?? []
      if (!edu.length) return <EmptyPreview />

      if (detail) {
        return (
          <div className="space-y-3">
            {edu.map((e: any, i: number) => (
              <div key={i} className="border-l-2 border-gray-700 pl-4">
                <p className="text-sm font-medium text-white">{e.degree}</p>
                {e.institution && <p className="text-xs text-gray-400">{e.institution}</p>}
                {(e.startDate || e.endDate) && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    {e.startDate}{e.endDate ? ` – ${e.endDate}` : ''}
                  </p>
                )}
                {e.grade && <p className="text-xs text-gray-400 mt-0.5">Grade: {e.grade}</p>}
              </div>
            ))}
          </div>
        )
      }

      return (
        <div className="space-y-1">
          {edu.slice(0, 2).map((e: any, i: number) => (
            <p key={i} className="text-xs text-gray-400">
              <span className="text-gray-200">{e.degree}</span>
              {e.institution && <span> — {e.institution}</span>}
            </p>
          ))}
          {edu.length > 2 && <p className="text-xs text-gray-600">+{edu.length - 2} more</p>}
        </div>
      )
    }

    case 'certifications': {
      const certs = (profile.certifications as any[]) ?? []
      if (!certs.length) return <EmptyPreview />

      if (detail) {
        return (
          <div className="space-y-2">
            {certs.map((c: any, i: number) => (
              <div key={i} className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm text-white">{c.name}</p>
                  {c.issuer && <p className="text-xs text-gray-400">{c.issuer}</p>}
                </div>
                {c.date && <span className="text-xs text-gray-500 flex-shrink-0">{c.date}</span>}
              </div>
            ))}
          </div>
        )
      }

      return (
        <p className="text-xs text-gray-400">
          {certs.slice(0, 3).map((c: any) => c.name).join(' · ')}
          {certs.length > 3 && <span className="text-gray-600"> · +{certs.length - 3} more</span>}
        </p>
      )
    }

    case 'skills': {
      const technical = (profile.skills as any)?.technical ?? []
      const domains = (profile.skills as any)?.domains ?? []
      const tools = (profile.skills as any)?.tools ?? []
      const hasAny = technical.length || domains.length || tools.length
      if (!hasAny) return <EmptyPreview />

      if (detail) {
        return (
          <div className="space-y-4">
            {technical.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-2">Technical</p>
                <div className="flex flex-wrap gap-1.5">
                  {technical.map((s: any, i: number) => (
                    <span key={i} className="text-xs bg-gray-800 text-gray-200 px-2 py-0.5 rounded-md">
                      {s.name}
                      {s.proficiency && <span className="text-gray-500 ml-1 text-[10px]">{s.proficiency}</span>}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {domains.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-2">Domains</p>
                <div className="flex flex-wrap gap-1.5">
                  {domains.map((s: any, i: number) => (
                    <span key={i} className="text-xs bg-gray-800/60 text-gray-300 px-2 py-0.5 rounded-md">{s.name}</span>
                  ))}
                </div>
              </div>
            )}
            {tools.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-2">Tools</p>
                <div className="flex flex-wrap gap-1.5">
                  {tools.map((s: any, i: number) => (
                    <span key={i} className="text-xs bg-gray-800/40 text-gray-400 px-2 py-0.5 rounded-md">{s.name}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      }

      return (
        <div className="flex flex-wrap gap-1.5">
          {technical.slice(0, 8).map((s: any, i: number) => (
            <span key={i} className="text-[11px] bg-gray-800 text-gray-300 px-2 py-0.5 rounded-md">{s.name}</span>
          ))}
          {technical.length > 8 && (
            <span className="text-[11px] text-gray-600">+{technical.length - 8}</span>
          )}
        </div>
      )
    }

    case 'portfolio': {
      const projects = (profile.portfolio as any[]) ?? []
      if (!projects.length) return <EmptyPreview />

      if (detail) {
        return (
          <div className="space-y-4">
            {projects.map((p: any, i: number) => (
              <div key={i} className="border-l-2 border-gray-700 pl-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-white">{p.name}</p>
                  {p.url && <a href={p.url} className="text-xs text-blue-400 flex-shrink-0">Link</a>}
                </div>
                {p.description && <p className="text-xs text-gray-400 mt-1 leading-relaxed">{p.description}</p>}
                {Array.isArray(p.technologies) && p.technologies.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {p.technologies.map((t: string, ti: number) => (
                      <span key={ti} className="text-[10px] bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded">{t}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      }

      return (
        <div className="flex flex-wrap gap-2">
          {projects.slice(0, 3).map((p: any, i: number) => (
            <span key={i} className="text-xs text-blue-400">{p.name}</span>
          ))}
          {projects.length > 3 && <span className="text-xs text-gray-600">+{projects.length - 3} more</span>}
        </div>
      )
    }

    case 'languages-soft-skills': {
      const langs = (profile.languages as any[]) ?? []
      const soft = (profile.softSkills as any[]) ?? []
      if (!langs.length && !soft.length) return <EmptyPreview />

      if (detail) {
        return (
          <div className="space-y-4">
            {langs.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-2">Languages</p>
                <div className="space-y-1">
                  {langs.map((l: any, i: number) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-sm text-white">{l.language}</span>
                      {l.proficiency && (
                        <span className="text-[10px] text-gray-400 bg-gray-800 px-2 py-0.5 rounded-full">{l.proficiency}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {soft.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-2">Soft Skills</p>
                <div className="flex flex-wrap gap-1.5">
                  {soft.map((s: any, i: number) => (
                    <span key={i} className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded-md">{s.skill}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      }

      return (
        <div className="flex flex-wrap gap-1.5">
          {langs.map((l: any, i: number) => (
            <span key={i} className="text-[11px] bg-gray-800 text-gray-200 px-2 py-0.5 rounded-md">
              {l.language}
              {l.proficiency && <span className="text-gray-500 ml-1">{l.proficiency}</span>}
            </span>
          ))}
          {soft.slice(0, 4).map((s: any, i: number) => (
            <span key={i} className="text-[11px] bg-gray-800/60 text-gray-400 px-2 py-0.5 rounded-md">{s.skill}</span>
          ))}
        </div>
      )
    }

    default:
      return <EmptyPreview />
  }
}
