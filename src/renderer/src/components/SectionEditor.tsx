import React, { useState } from 'react'
import { useStore, WizardSection } from '../store'

interface Props {
  section: WizardSection
}

export default function SectionEditor({ section }: Props): React.JSX.Element {
  const { profile, setProfile } = useStore()

  const save = async (updated: Record<string, unknown>) => {
    setProfile(updated)
    await (window as any).api.profile.write(updated)
  }

  switch (section.id) {
    case 'work-experience': return <WorkExperienceEditor profile={profile} save={save} />
    case 'education': return <EducationEditor profile={profile} save={save} />
    case 'certifications': return <CertificationsEditor profile={profile} save={save} />
    case 'skills': return <SkillsEditor profile={profile} save={save} />
    case 'portfolio': return <PortfolioEditor profile={profile} save={save} />
    case 'languages-soft-skills': return <LanguagesSoftSkillsEditor profile={profile} save={save} />
    default: return <></>
  }
}

// ─── Shared helpers ──────────────────────────────────────────────────────────

function DeleteButton({ onClick }: { onClick: (e: React.MouseEvent) => void }): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      className="ml-auto flex-shrink-0 text-red-500 hover:text-red-400 transition-colors p-1 rounded"
      title="Remove"
    >
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
      </svg>
    </button>
  )
}

function AddButton({ onClick, label = 'Add' }: { onClick: () => void; label?: string }): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors mt-3"
    >
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
      </svg>
      {label}
    </button>
  )
}

function Input({ label, value, onChange, placeholder, type = 'text', className = '' }: {
  label?: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; className?: string
}): React.JSX.Element {
  return (
    <div className={className}>
      {label && <label className="block text-[11px] text-gray-500 mb-1">{label}</label>}
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
      />
    </div>
  )
}

function SaveRowButton({ onClick }: { onClick: () => void }): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition-colors"
    >
      Add
    </button>
  )
}

// ─── Work Experience ──────────────────────────────────────────────────────────

const EMPTY_JOB = { title: '', company: '', department: '', startDate: '', endDate: '', current: false, summary: '', achievements: '' }

function jobToForm(j: any) {
  return {
    title: j.title ?? '',
    company: j.company ?? '',
    department: j.department ?? '',
    startDate: j.startDate ?? '',
    endDate: j.endDate ?? '',
    current: j.current ?? false,
    summary: j.summary ?? '',
    achievements: Array.isArray(j.achievements) ? j.achievements.join('\n') : (j.achievements ?? ''),
  }
}

function formToJob(form: typeof EMPTY_JOB): Record<string, unknown> {
  const achievements = form.achievements
    .split('\n')
    .map((l: string) => l.replace(/^[-•]\s*/, '').trim())
    .filter(Boolean)
  return {
    title: form.title,
    company: form.company || undefined,
    department: form.department || undefined,
    startDate: form.startDate || undefined,
    endDate: form.current ? undefined : (form.endDate || undefined),
    current: form.current || undefined,
    summary: form.summary || undefined,
    achievements: achievements.length ? achievements : undefined,
  }
}

function JobForm({ form, setForm, onSave, onCancel, saveLabel = 'Add', onRemove }: {
  form: typeof EMPTY_JOB
  setForm: React.Dispatch<React.SetStateAction<typeof EMPTY_JOB>>
  onSave: () => void
  onCancel: () => void
  saveLabel?: string
  onRemove?: () => void
}): React.JSX.Element {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Input label="Job title *" value={form.title} onChange={v => setForm(f => ({ ...f, title: v }))} placeholder="Software Engineer" />
        <Input label="Company" value={form.company} onChange={v => setForm(f => ({ ...f, company: v }))} placeholder="Acme Corp" />
      </div>
      <Input label="Department / team" value={form.department} onChange={v => setForm(f => ({ ...f, department: v }))} placeholder="Data & Analytics" />
      <div className="grid grid-cols-2 gap-2">
        <Input label="Start date" value={form.startDate} onChange={v => setForm(f => ({ ...f, startDate: v }))} placeholder="Jan 2023" />
        <Input label="End date" value={form.endDate} onChange={v => setForm(f => ({ ...f, endDate: v }))} placeholder="Dec 2024" />
      </div>
      <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
        <input type="checkbox" checked={form.current} onChange={e => setForm(f => ({ ...f, current: e.target.checked }))} className="accent-blue-500" />
        Current role
      </label>
      <div>
        <label className="block text-[11px] text-gray-500 mb-1">Role description / summary</label>
        <textarea
          value={form.summary}
          onChange={e => setForm(f => ({ ...f, summary: e.target.value }))}
          placeholder="Describe the scope of the role, team size, responsibilities…"
          rows={3}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors resize-none"
        />
      </div>
      <div>
        <label className="block text-[11px] text-gray-500 mb-1">Key achievements <span className="text-gray-600">(one per line)</span></label>
        <textarea
          value={form.achievements}
          onChange={e => setForm(f => ({ ...f, achievements: e.target.value }))}
          placeholder={"Reduced API latency by 40% through caching\nLed migration of 3 services to Kubernetes\nMentored 2 junior engineers"}
          rows={5}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors resize-none font-mono text-xs"
        />
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onSave}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition-colors"
        >
          {saveLabel}
        </button>
        <button onClick={onCancel} className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors">Cancel</button>
        {onRemove && (
          <DeleteButton onClick={(e) => { e.stopPropagation(); onRemove() }} />
        )}
      </div>
    </div>
  )
}

function JobRow({ job, onRemove, onSave }: {
  job: any
  onRemove: () => void
  onSave: (updated: Record<string, unknown>) => void
}): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(EMPTY_JOB)

  const startEdit = () => {
    setForm(jobToForm(job))
    setEditing(true)
    setExpanded(false)
  }

  const saveEdit = () => {
    if (!form.title.trim()) return
    onSave(formToJob(form))
    setEditing(false)
  }

  const achievementCount = Array.isArray(job.achievements) ? job.achievements.length : 0

  if (editing) {
    return (
      <div className="py-3 border-b border-gray-800 last:border-0">
        <JobForm form={form} setForm={setForm} onSave={saveEdit} onCancel={() => setEditing(false)} saveLabel="Save" onRemove={onRemove} />
      </div>
    )
  }

  return (
    <div className="border-b border-gray-800 last:border-0">
      {/* Header row — always visible */}
      <div
        className="flex items-start gap-2 py-2.5 cursor-pointer group"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white leading-snug">{job.title}</p>
          <p className="text-xs text-gray-400">
            {[job.company, job.department].filter(Boolean).join(' - ')}
            {job.startDate ? ` · ${job.startDate}${job.current ? ' – Present' : job.endDate ? ` – ${job.endDate}` : ''}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {!expanded && achievementCount > 0 && (
            <span className="text-[10px] text-gray-600 mr-1">{achievementCount} achievement{achievementCount !== 1 ? 's' : ''}</span>
          )}
          {/* Chevron */}
          <svg
            className={`w-3.5 h-3.5 text-gray-600 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="pb-3 space-y-2.5">
          {job.summary && (
            <p className="text-xs text-gray-400 leading-relaxed">{job.summary}</p>
          )}
          {achievementCount > 0 && (
            <ul className="space-y-1">
              {job.achievements.map((a: string, ai: number) => (
                <li key={ai} className="text-xs text-gray-400 flex gap-2">
                  <span className="text-gray-600 flex-shrink-0 mt-px">•</span>{a}
                </li>
              ))}
            </ul>
          )}
          <button
            onClick={startEdit}
            className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors mt-1"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit role
          </button>
        </div>
      )}
    </div>
  )
}

function WorkExperienceEditor({ profile, save }: { profile: Record<string, unknown>; save: (p: Record<string, unknown>) => void }): React.JSX.Element {
  const jobs = (profile.workExperience as any[]) ?? []
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState(EMPTY_JOB)

  const removeJob = (i: number) => {
    save({ ...profile, workExperience: jobs.filter((_, idx) => idx !== i) })
  }

  const updateJob = (i: number, updated: Record<string, unknown>) => {
    const next = jobs.map((j, idx) => idx === i ? updated : j)
    save({ ...profile, workExperience: next })
  }

  const addJob = () => {
    if (!form.title.trim()) return
    save({ ...profile, workExperience: [...jobs, formToJob(form)] })
    setForm(EMPTY_JOB)
    setAdding(false)
  }

  return (
    <div>
      {jobs.map((j: any, i: number) => (
        <JobRow key={i} job={j} onRemove={() => removeJob(i)} onSave={(updated) => updateJob(i, updated)} />
      ))}

      {adding ? (
        <div className="pt-3 border-t border-gray-800">
          <JobForm form={form} setForm={setForm} onSave={addJob} onCancel={() => { setAdding(false); setForm(EMPTY_JOB) }} />
        </div>
      ) : (
        <AddButton onClick={() => setAdding(true)} label="Add role" />
      )}
    </div>
  )
}

// ─── Education ───────────────────────────────────────────────────────────────

const EMPTY_EDU = { institution: '', degree: '', field: '', startDate: '', endDate: '', grade: '', description: '' }

function EduRow({ item, onRemove, onSave }: { item: any; onRemove: () => void; onSave: (u: any) => void }): React.JSX.Element {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(EMPTY_EDU)

  const startEdit = () => {
    setForm({ institution: item.institution ?? '', degree: item.degree ?? '', field: item.field ?? '', startDate: item.startDate ?? '', endDate: item.endDate ?? '', grade: item.grade ?? '', description: item.description ?? '' })
    setEditing(true)
  }
  const saveEdit = () => {
    if (!form.institution.trim() && !form.degree.trim()) return
    onSave({ institution: form.institution || undefined, degree: form.degree || undefined, field: form.field || undefined, startDate: form.startDate || undefined, endDate: form.endDate || undefined, grade: form.grade || undefined, description: form.description || undefined })
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="py-3 border-b border-gray-800 last:border-0 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <Input label="Institution *" value={form.institution} onChange={v => setForm(f => ({ ...f, institution: v }))} placeholder="University of Sydney" />
          <Input label="Degree / qualification" value={form.degree} onChange={v => setForm(f => ({ ...f, degree: v }))} placeholder="B.Sc Computer Science" />
        </div>
        <Input label="Field of study" value={form.field} onChange={v => setForm(f => ({ ...f, field: v }))} placeholder="Computer Science" />
        <div className="grid grid-cols-3 gap-2">
          <Input label="Start date" value={form.startDate} onChange={v => setForm(f => ({ ...f, startDate: v }))} placeholder="2018" />
          <Input label="End date" value={form.endDate} onChange={v => setForm(f => ({ ...f, endDate: v }))} placeholder="2021" />
          <Input label="Grade / result" value={form.grade} onChange={v => setForm(f => ({ ...f, grade: v }))} placeholder="First Class" />
        </div>
        <div>
          <label className="block text-[11px] text-gray-500 mb-1">Additional notes</label>
          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Thesis topic, notable modules, activities…" rows={2} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors resize-none" />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={saveEdit} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition-colors">Save</button>
          <button onClick={() => setEditing(false)} className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors">Cancel</button>
          <DeleteButton onClick={(e) => { e.stopPropagation(); onRemove() }} />
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-2 py-2.5 border-b border-gray-800 last:border-0 group">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white leading-snug">{item.degree || item.institution}</p>
        <p className="text-xs text-gray-400">{item.degree ? item.institution : ''}{item.startDate ? ` · ${item.startDate}${item.endDate ? ` – ${item.endDate}` : ''}` : ''}</p>
        {item.description && <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{item.description}</p>}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button onClick={startEdit} className="text-gray-600 hover:text-blue-400 transition-colors p-1 opacity-0 group-hover:opacity-100">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
        </button>
      </div>
    </div>
  )
}

function EducationEditor({ profile, save }: { profile: Record<string, unknown>; save: (p: Record<string, unknown>) => void }): React.JSX.Element {
  const items = (profile.education as any[]) ?? []
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState(EMPTY_EDU)

  const remove = (i: number) => save({ ...profile, education: items.filter((_, idx) => idx !== i) })
  const update = (i: number, u: any) => save({ ...profile, education: items.map((it, idx) => idx === i ? u : it) })

  const add = () => {
    if (!form.institution.trim() && !form.degree.trim()) return
    save({ ...profile, education: [...items, { institution: form.institution || undefined, degree: form.degree || undefined, field: form.field || undefined, startDate: form.startDate || undefined, endDate: form.endDate || undefined, grade: form.grade || undefined, description: form.description || undefined }] })
    setForm(EMPTY_EDU)
    setAdding(false)
  }

  return (
    <div>
      {items.map((e: any, i: number) => (
        <EduRow key={i} item={e} onRemove={() => remove(i)} onSave={(u) => update(i, u)} />
      ))}
      {adding ? (
        <div className="pt-3 border-t border-gray-800 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Input label="Institution *" value={form.institution} onChange={v => setForm(f => ({ ...f, institution: v }))} placeholder="University of Sydney" />
            <Input label="Degree / qualification" value={form.degree} onChange={v => setForm(f => ({ ...f, degree: v }))} placeholder="B.Sc Computer Science" />
          </div>
          <Input label="Field of study" value={form.field} onChange={v => setForm(f => ({ ...f, field: v }))} placeholder="Computer Science" />
          <div className="grid grid-cols-3 gap-2">
            <Input label="Start date" value={form.startDate} onChange={v => setForm(f => ({ ...f, startDate: v }))} placeholder="2018" />
            <Input label="End date" value={form.endDate} onChange={v => setForm(f => ({ ...f, endDate: v }))} placeholder="2021" />
            <Input label="Grade / result" value={form.grade} onChange={v => setForm(f => ({ ...f, grade: v }))} placeholder="First Class" />
          </div>
          <div>
            <label className="block text-[11px] text-gray-500 mb-1">Additional notes</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Thesis topic, notable modules, activities…" rows={2} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors resize-none" />
          </div>
          <div className="flex gap-2">
            <SaveRowButton onClick={add} />
            <button onClick={() => { setAdding(false); setForm(EMPTY_EDU) }} className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors">Cancel</button>
          </div>
        </div>
      ) : (
        <AddButton onClick={() => setAdding(true)} label="Add education" />
      )}
    </div>
  )
}

// ─── Certifications ───────────────────────────────────────────────────────────

const EMPTY_CERT = { name: '', issuer: '', date: '', credentialId: '', url: '' }

function CertRow({ item, onRemove, onSave }: { item: any; onRemove: () => void; onSave: (u: any) => void }): React.JSX.Element {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(EMPTY_CERT)

  const startEdit = () => {
    setForm({ name: item.name ?? '', issuer: item.issuer ?? '', date: item.date ?? '', credentialId: item.credentialId ?? '', url: item.url ?? '' })
    setEditing(true)
  }
  const saveEdit = () => {
    if (!form.name.trim()) return
    onSave({ name: form.name, issuer: form.issuer || undefined, date: form.date || undefined, credentialId: form.credentialId || undefined, url: form.url || undefined })
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="py-3 border-b border-gray-800 last:border-0 space-y-2">
        <Input label="Certification name *" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} placeholder="AWS Solutions Architect" />
        <div className="grid grid-cols-2 gap-2">
          <Input label="Issuer" value={form.issuer} onChange={v => setForm(f => ({ ...f, issuer: v }))} placeholder="Amazon Web Services" />
          <Input label="Date" value={form.date} onChange={v => setForm(f => ({ ...f, date: v }))} placeholder="Jun 2024" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Input label="Credential ID" value={form.credentialId} onChange={v => setForm(f => ({ ...f, credentialId: v }))} placeholder="ABC-123" />
          <Input label="Verification URL" value={form.url} onChange={v => setForm(f => ({ ...f, url: v }))} placeholder="https://..." />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={saveEdit} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition-colors">Save</button>
          <button onClick={() => setEditing(false)} className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors">Cancel</button>
          <DeleteButton onClick={(e) => { e.stopPropagation(); onRemove() }} />
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 py-2.5 border-b border-gray-800 last:border-0 group">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white leading-snug">{item.name}</p>
        <p className="text-xs text-gray-400">{[item.issuer, item.date].filter(Boolean).join(' · ')}</p>
        {item.credentialId && <p className="text-xs text-gray-600 mt-0.5">ID: {item.credentialId}</p>}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button onClick={startEdit} className="text-gray-600 hover:text-blue-400 transition-colors p-1 opacity-0 group-hover:opacity-100">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
        </button>
      </div>
    </div>
  )
}

function CertificationsEditor({ profile, save }: { profile: Record<string, unknown>; save: (p: Record<string, unknown>) => void }): React.JSX.Element {
  const items = (profile.certifications as any[]) ?? []
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState(EMPTY_CERT)

  const remove = (i: number) => save({ ...profile, certifications: items.filter((_, idx) => idx !== i) })
  const update = (i: number, u: any) => save({ ...profile, certifications: items.map((it, idx) => idx === i ? u : it) })

  const add = () => {
    if (!form.name.trim()) return
    save({ ...profile, certifications: [...items, { name: form.name, issuer: form.issuer || undefined, date: form.date || undefined, credentialId: form.credentialId || undefined, url: form.url || undefined }] })
    setForm(EMPTY_CERT)
    setAdding(false)
  }

  return (
    <div>
      {items.map((c: any, i: number) => (
        <CertRow key={i} item={c} onRemove={() => remove(i)} onSave={(u) => update(i, u)} />
      ))}
      {adding ? (
        <div className="pt-3 border-t border-gray-800 space-y-2">
          <Input label="Certification name *" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} placeholder="AWS Solutions Architect" />
          <div className="grid grid-cols-2 gap-2">
            <Input label="Issuer" value={form.issuer} onChange={v => setForm(f => ({ ...f, issuer: v }))} placeholder="Amazon Web Services" />
            <Input label="Date" value={form.date} onChange={v => setForm(f => ({ ...f, date: v }))} placeholder="Jun 2024" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input label="Credential ID" value={form.credentialId} onChange={v => setForm(f => ({ ...f, credentialId: v }))} placeholder="ABC-123" />
            <Input label="Verification URL" value={form.url} onChange={v => setForm(f => ({ ...f, url: v }))} placeholder="https://..." />
          </div>
          <div className="flex gap-2">
            <SaveRowButton onClick={add} />
            <button onClick={() => { setAdding(false); setForm(EMPTY_CERT) }} className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors">Cancel</button>
          </div>
        </div>
      ) : (
        <AddButton onClick={() => setAdding(true)} label="Add certification" />
      )}
    </div>
  )
}

// ─── Skills ───────────────────────────────────────────────────────────────────

type SkillCategory = 'technical' | 'domains' | 'tools'

function SkillsEditor({ profile, save }: { profile: Record<string, unknown>; save: (p: Record<string, unknown>) => void }): React.JSX.Element {
  const skills = (profile.skills as Record<string, any>) ?? {}
  const technical: string[] = skills.technical ?? []
  const domains: string[] = skills.domains ?? []
  const tools: string[] = skills.tools ?? []

  const [newSkill, setNewSkill] = useState('')
  const [category, setCategory] = useState<SkillCategory>('technical')

  const removeSkill = (cat: SkillCategory, name: string) => {
    save({ ...profile, skills: { ...skills, [cat]: (skills[cat] as string[]).filter((s: string) => s !== name) } })
  }

  const addSkill = () => {
    const val = newSkill.trim()
    if (!val) return
    const existing = (skills[category] as string[]) ?? []
    if (existing.includes(val)) { setNewSkill(''); return }
    save({ ...profile, skills: { ...skills, [category]: [...existing, val] } })
    setNewSkill('')
  }

  const SkillTag = ({ name, cat }: { name: string; cat: SkillCategory }) => (
    <span className="inline-flex items-center gap-1 bg-gray-800 border border-gray-700 text-gray-300 text-xs px-2 py-1 rounded-md">
      {name}
      <button onClick={() => removeSkill(cat, name)} className="text-gray-600 hover:text-red-400 transition-colors ml-0.5">
        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </span>
  )

  return (
    <div className="space-y-4">
      {technical.length > 0 && (
        <div>
          <p className="text-[11px] text-gray-500 mb-2">Technical</p>
          <div className="flex flex-wrap gap-1.5">{technical.map(s => <SkillTag key={s} name={s} cat="technical" />)}</div>
        </div>
      )}
      {domains.length > 0 && (
        <div>
          <p className="text-[11px] text-gray-500 mb-2">Domains</p>
          <div className="flex flex-wrap gap-1.5">{domains.map(s => <SkillTag key={s} name={s} cat="domains" />)}</div>
        </div>
      )}
      {tools.length > 0 && (
        <div>
          <p className="text-[11px] text-gray-500 mb-2">Tools</p>
          <div className="flex flex-wrap gap-1.5">{tools.map(s => <SkillTag key={s} name={s} cat="tools" />)}</div>
        </div>
      )}

      {/* Add skill */}
      <div className="flex gap-2 items-end pt-1">
        <div className="flex-1">
          <input
            value={newSkill}
            onChange={e => setNewSkill(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSkill() } }}
            placeholder="Add a skill…"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
        <select
          value={category}
          onChange={e => setCategory(e.target.value as SkillCategory)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-xs text-gray-300 focus:outline-none focus:border-blue-500"
        >
          <option value="technical">Technical</option>
          <option value="domains">Domain</option>
          <option value="tools">Tool</option>
        </select>
        <SaveRowButton onClick={addSkill} />
      </div>
    </div>
  )
}

// ─── Portfolio ────────────────────────────────────────────────────────────────

const EMPTY_PROJECT = { name: '', description: '', url: '', technologies: '' }

function projectToForm(p: any) {
  return { name: p.name ?? '', description: p.description ?? '', url: p.url ?? '', technologies: Array.isArray(p.technologies) ? p.technologies.join(', ') : (p.technologies ?? '') }
}

function ProjectForm({ form, setForm, onSave, onCancel, saveLabel = 'Add', onRemove }: { form: typeof EMPTY_PROJECT; setForm: React.Dispatch<React.SetStateAction<typeof EMPTY_PROJECT>>; onSave: () => void; onCancel: () => void; saveLabel?: string; onRemove?: () => void }): React.JSX.Element {
  return (
    <div className="space-y-2">
      <Input label="Project name *" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} placeholder="My Project" />
      <div>
        <label className="block text-[11px] text-gray-500 mb-1">Description</label>
        <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What does it do? What problem does it solve?" rows={3} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors resize-none" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input label="URL" value={form.url} onChange={v => setForm(f => ({ ...f, url: v }))} placeholder="https://..." />
        <Input label="Technologies (comma-separated)" value={form.technologies} onChange={v => setForm(f => ({ ...f, technologies: v }))} placeholder="React, TypeScript" />
      </div>
      <div className="flex items-center gap-2">
        <button onClick={onSave} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition-colors">{saveLabel}</button>
        <button onClick={onCancel} className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors">Cancel</button>
        {onRemove && <DeleteButton onClick={(e) => { e.stopPropagation(); onRemove() }} />}
      </div>
    </div>
  )
}

function ProjectRow({ item, onRemove, onSave }: { item: any; onRemove: () => void; onSave: (u: any) => void }): React.JSX.Element {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(EMPTY_PROJECT)

  const startEdit = () => { setForm(projectToForm(item)); setEditing(true) }
  const saveEdit = () => {
    if (!form.name.trim()) return
    const technologies = form.technologies.split(',').map((t: string) => t.trim()).filter(Boolean)
    onSave({ name: form.name, description: form.description || undefined, url: form.url || undefined, technologies })
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="py-3 border-b border-gray-800 last:border-0">
        <ProjectForm form={form} setForm={setForm} onSave={saveEdit} onCancel={() => setEditing(false)} saveLabel="Save" onRemove={onRemove} />
      </div>
    )
  }

  return (
    <div className="flex items-start gap-2 py-2.5 border-b border-gray-800 last:border-0 group">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white leading-snug">{item.name}</p>
        {item.description && <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{item.description}</p>}
        {Array.isArray(item.technologies) && item.technologies.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {item.technologies.map((t: string, ti: number) => (
              <span key={ti} className="text-[10px] bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded">{t}</span>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button onClick={startEdit} className="text-gray-600 hover:text-blue-400 transition-colors p-1 opacity-0 group-hover:opacity-100">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
        </button>
      </div>
    </div>
  )
}

function PortfolioEditor({ profile, save }: { profile: Record<string, unknown>; save: (p: Record<string, unknown>) => void }): React.JSX.Element {
  const items = (profile.portfolio as any[]) ?? []
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState(EMPTY_PROJECT)

  const remove = (i: number) => save({ ...profile, portfolio: items.filter((_, idx) => idx !== i) })
  const update = (i: number, u: any) => save({ ...profile, portfolio: items.map((it, idx) => idx === i ? u : it) })

  const add = () => {
    if (!form.name.trim()) return
    const technologies = form.technologies.split(',').map(t => t.trim()).filter(Boolean)
    save({ ...profile, portfolio: [...items, { name: form.name, description: form.description || undefined, url: form.url || undefined, technologies }] })
    setForm(EMPTY_PROJECT)
    setAdding(false)
  }

  return (
    <div>
      {items.map((p: any, i: number) => (
        <ProjectRow key={i} item={p} onRemove={() => remove(i)} onSave={(u) => update(i, u)} />
      ))}
      {adding ? (
        <div className="pt-3 border-t border-gray-800">
          <ProjectForm form={form} setForm={setForm} onSave={add} onCancel={() => { setAdding(false); setForm(EMPTY_PROJECT) }} />
        </div>
      ) : (
        <AddButton onClick={() => setAdding(true)} label="Add project" />
      )}
    </div>
  )
}

// ─── Languages & Soft Skills ──────────────────────────────────────────────────

const PROFICIENCY_OPTIONS = ['Native', 'Fluent', 'Professional', 'Conversational', 'Basic']

function LanguagesSoftSkillsEditor({ profile, save }: { profile: Record<string, unknown>; save: (p: Record<string, unknown>) => void }): React.JSX.Element {
  const languages = (profile.languages as any[]) ?? []
  const softSkills = (profile.softSkills as any[]) ?? []

  const [newLang, setNewLang] = useState('')
  const [langProf, setLangProf] = useState('Professional')
  const [newSkill, setNewSkill] = useState('')

  const removeLang = (i: number) => save({ ...profile, languages: languages.filter((_, idx) => idx !== i) })
  const removeSoft = (i: number) => save({ ...profile, softSkills: softSkills.filter((_, idx) => idx !== i) })

  const addLang = () => {
    const val = newLang.trim()
    if (!val) return
    save({ ...profile, languages: [...languages, { language: val, proficiency: langProf }] })
    setNewLang('')
  }

  const addSoft = () => {
    const val = newSkill.trim()
    if (!val) return
    const existing = softSkills.map((s: any) => typeof s === 'string' ? s : s.skill)
    if (existing.includes(val)) { setNewSkill(''); return }
    save({ ...profile, softSkills: [...softSkills, { skill: val }] })
    setNewSkill('')
  }

  return (
    <div className="space-y-5">
      {/* Languages */}
      <div>
        <p className="text-xs text-gray-500 mb-2">Languages</p>
        <div className="space-y-1.5">
          {languages.map((l: any, i: number) => (
            <div key={i} className="flex items-center gap-2 group">
              <span className="text-sm text-white flex-1">{l.language}</span>
              <select
                value={l.proficiency ?? 'Professional'}
                onChange={e => {
                  const updated = languages.map((lang: any, idx: number) => idx === i ? { ...lang, proficiency: e.target.value } : lang)
                  save({ ...profile, languages: updated })
                }}
                className="bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-[10px] text-gray-300 focus:outline-none focus:border-blue-500"
              >
                {PROFICIENCY_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
              <DeleteButton onClick={(e) => { e.stopPropagation(); removeLang(i) }} />
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-2">
          <input
            value={newLang}
            onChange={e => setNewLang(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addLang() } }}
            placeholder="Language"
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
          />
          <select
            value={langProf}
            onChange={e => setLangProf(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-xs text-gray-300 focus:outline-none focus:border-blue-500"
          >
            {PROFICIENCY_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          <SaveRowButton onClick={addLang} />
        </div>
      </div>

      {/* Soft skills */}
      <div>
        <p className="text-xs text-gray-500 mb-2">Soft Skills</p>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {softSkills.map((s: any, i: number) => {
            const label = typeof s === 'string' ? s : s.skill
            return (
              <span key={i} className="inline-flex items-center gap-1 bg-gray-800 border border-gray-700 text-gray-300 text-xs px-2 py-1 rounded-md">
                {label}
                <button onClick={() => removeSoft(i)} className="text-gray-600 hover:text-red-400 transition-colors ml-0.5">
                  <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            )
          })}
        </div>
        <div className="flex gap-2">
          <input
            value={newSkill}
            onChange={e => setNewSkill(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSoft() } }}
            placeholder="e.g. Communication, Leadership"
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
          />
          <SaveRowButton onClick={addSoft} />
        </div>
      </div>
    </div>
  )
}
