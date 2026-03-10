import React, { useState, useEffect } from 'react'
import { useStore } from '../store'

// The importer stores personal as a flat object:
// { fullName, email, phone, location (string), linkedin, github, website }
// This form reads/writes that same flat shape.

export default function PersonalInfoForm(): React.JSX.Element {
  const { profile, setProfile } = useStore()
  const p = (profile.personal ?? {}) as Record<string, any>

  // location may be a string ("Australia") or an object ({ city, country })
  const locationStr = typeof p.location === 'string'
    ? p.location
    : [p.location?.city, p.location?.country].filter(Boolean).join(', ')

  const [form, setForm] = useState({
    fullName: p.fullName ?? '',
    preferredName: p.preferredName ?? '',
    email: p.email ?? '',
    phone: p.phone ?? '',
    location: locationStr,
    github: p.github ?? p.links?.github ?? '',
    website: p.website ?? p.links?.portfolio ?? '',
  })
  const [saved, setSaved] = useState(false)

  // Sync if profile changes externally
  useEffect(() => {
    const p2 = (profile.personal ?? {}) as Record<string, any>
    const loc2 = typeof p2.location === 'string'
      ? p2.location
      : [p2.location?.city, p2.location?.country].filter(Boolean).join(', ')
    setForm({
      fullName: p2.fullName ?? '',
      preferredName: p2.preferredName ?? '',
      email: p2.email ?? '',
      phone: p2.phone ?? '',
      location: loc2,
      github: p2.github ?? p2.links?.github ?? '',
      website: p2.website ?? p2.links?.portfolio ?? '',
    })
  }, [profile.personal])

  const linkedinUrl: string = p.linkedin ?? p.links?.linkedin ?? ''

  const handleChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
    setSaved(false)
  }

  const handleSave = async () => {
    const updated = {
      ...profile,
      personal: {
        ...p,
        fullName: form.fullName || undefined,
        preferredName: form.preferredName || undefined,
        email: form.email || undefined,
        phone: form.phone || undefined,
        location: form.location || undefined,
        github: form.github || undefined,
        website: form.website || undefined,
      }
    }
    setProfile(updated)
    await (window as any).api.profile.write(updated)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="space-y-5">
      {/* Name */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Full name" value={form.fullName} onChange={v => handleChange('fullName', v)} placeholder="Alastair Grant" />
        <Field label="Preferred name" value={form.preferredName} onChange={v => handleChange('preferredName', v)} placeholder="Al (optional)" />
      </div>

      {/* Contact */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Email" value={form.email} onChange={v => handleChange('email', v)} placeholder="you@example.com" type="email" />
        <Field label="Phone" value={form.phone} onChange={v => handleChange('phone', v)} placeholder="+61 4xx xxx xxx" type="tel" />
      </div>

      {/* Location */}
      <Field label="Location" value={form.location} onChange={v => handleChange('location', v)} placeholder="Sydney, Australia" />

      {/* Connected accounts */}
      <div className="space-y-3">
        <p className="text-xs text-gray-400 uppercase tracking-wider">Online presence</p>

        {/* LinkedIn — show as connected badge if present, otherwise input */}
        {linkedinUrl ? (
          <ConnectedBadge
            label="LinkedIn"
            url={linkedinUrl}
            icon={<LinkedInIcon />}
            color="text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-400/10 border-blue-200 dark:border-blue-400/20"
          />
        ) : (
          <Field label="LinkedIn URL" value="" onChange={() => {}} placeholder="https://linkedin.com/in/… (connect on the intro screen)" disabled />
        )}

        {/* GitHub */}
        <Field
          label="GitHub"
          value={form.github}
          onChange={v => handleChange('github', v)}
          placeholder="https://github.com/..."
          prefix="github.com/"
        />

        {/* Portfolio / website */}
        <Field
          label="Portfolio / website"
          value={form.website}
          onChange={v => handleChange('website', v)}
          placeholder="https://..."
        />
      </div>

      {/* Save */}
      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={handleSave}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Save
        </button>
        {saved && <span className="text-xs text-green-600 dark:text-green-400">Saved</span>}
      </div>
    </div>
  )
}

function ConnectedBadge({ label, url, icon, color }: {
  label: string
  url: string
  icon: React.ReactNode
  color: string
}): React.JSX.Element {
  // Extract a display handle from the URL (last path segment)
  const handle = url.replace(/\/$/, '').split('/').pop() ?? url

  return (
    <div>
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-opacity hover:opacity-80 ${color}`}
      >
        {icon}
        <span>{handle}</span>
        <span className="text-[10px] opacity-60 ml-1">Connected ✓</span>
      </a>
    </div>
  )
}

function LinkedInIcon(): React.JSX.Element {
  return (
    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  )
}

function Field({
  label, value, onChange, placeholder, type = 'text', prefix, disabled = false
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  prefix?: string
  disabled?: boolean
}): React.JSX.Element {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      <div className="flex items-center bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden focus-within:border-blue-500 transition-colors">
        {prefix && (
          <span className="pl-3 text-sm text-gray-400 select-none flex-shrink-0">{prefix}</span>
        )}
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="flex-1 bg-transparent px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed"
        />
      </div>
    </div>
  )
}
