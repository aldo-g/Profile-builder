import { app } from 'electron'
import { join } from 'path'
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  unlinkSync
} from 'fs'

export interface SnapshotMeta {
  id: string        // filename without extension
  label: string     // human-readable description
  savedAt: string   // ISO timestamp
  size: number      // bytes
}

const versionsDir = (): string => {
  const dir = join(app.getPath('userData'), 'profile-versions')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

/** Save a snapshot. Returns the snapshot id. */
export function saveSnapshot(profile: object, label: string): string {
  const dir = versionsDir()
  const id = `snapshot-${Date.now()}`
  const filePath = join(dir, `${id}.json`)
  const data = JSON.stringify({ id, label, savedAt: new Date().toISOString(), profile }, null, 2)
  writeFileSync(filePath, data, 'utf-8')
  pruneOldSnapshots(dir)
  return id
}

/** Return metadata for all snapshots, newest first. */
export function listSnapshots(): SnapshotMeta[] {
  const dir = versionsDir()
  return readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      const raw = JSON.parse(readFileSync(join(dir, f), 'utf-8'))
      return {
        id: raw.id,
        label: raw.label,
        savedAt: raw.savedAt,
        size: Buffer.byteLength(JSON.stringify(raw.profile), 'utf-8')
      } as SnapshotMeta
    })
    .sort((a, b) => (a.savedAt > b.savedAt ? -1 : 1))
}

/** Load the full profile object from a snapshot. */
export function loadSnapshot(id: string): Record<string, unknown> {
  const filePath = join(versionsDir(), `${id}.json`)
  if (!existsSync(filePath)) throw new Error(`Snapshot not found: ${id}`)
  return JSON.parse(readFileSync(filePath, 'utf-8')).profile
}

/** Delete a single snapshot. */
export function deleteSnapshot(id: string): void {
  const filePath = join(versionsDir(), `${id}.json`)
  if (existsSync(filePath)) unlinkSync(filePath)
}

/** Keep at most 50 snapshots — remove oldest when over the limit. */
function pruneOldSnapshots(dir: string): void {
  const MAX = 50
  const files = readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .sort() // lexicographic = chronological for timestamp-based names
  if (files.length > MAX) {
    files.slice(0, files.length - MAX).forEach(f => unlinkSync(join(dir, f)))
  }
}
