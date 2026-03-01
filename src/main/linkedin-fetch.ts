import { BrowserWindow, DownloadItem, session } from 'electron'

import { tmpdir } from 'os'
import { join } from 'path'

function normaliseProfileUrl(input: string): string {
  const s = input.trim().replace(/\/$/, '')
  if (s.startsWith('http')) return s
  if (s.startsWith('linkedin.com')) return `https://${s}`
  if (s.startsWith('/in/')) return `https://www.linkedin.com${s}`
  // bare handle like "alastair-grant-genai-dev"
  if (!s.includes('/')) return `https://www.linkedin.com/in/${s}`
  return `https://${s}`
}

function getProfilePath(url: string): string | null {
  try {
    const match = new URL(url).pathname.match(/^\/in\/[^/?#]+/)
    return match ? match[0] : null
  } catch {
    return null
  }
}

function isAuthWall(url: string): boolean {
  return url.includes('/login') || url.includes('/checkpoint') || url.includes('/authwall') || url.includes('/uas/login')
}

export function fetchLinkedInPdf(profileUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const canonicalUrl = normaliseProfileUrl(profileUrl)
    const profilePath = getProfilePath(canonicalUrl)

    if (!profilePath) {
      reject(new Error('Could not parse a LinkedIn profile path from that URL.'))
      return
    }

    const resolvedProfilePath: string = profilePath

    const linkedInSession = session.fromPartition('persist:linkedin-fetch')

    const win = new BrowserWindow({
      width: 460,
      height: 680,
      title: 'Sign in to LinkedIn',
      autoHideMenuBar: true,
      webPreferences: {
        session: linkedInSession,
        nodeIntegration: false,
        contextIsolation: true
      }
    })

    let downloadTriggered = false
    let settled = false

    function fail(msg: string): void {
      if (settled) return
      settled = true
      linkedInSession.removeAllListeners('will-download')
      if (!win.isDestroyed()) win.close()
      reject(new Error(msg))
    }

    function succeed(path: string): void {
      if (settled) return
      settled = true
      linkedInSession.removeAllListeners('will-download')
      if (!win.isDestroyed()) win.close()
      resolve(path)
    }

    // Intercept the PDF download that LinkedIn's "Save to PDF" triggers
    linkedInSession.on('will-download', (_event, item: DownloadItem) => {
      const outPath = join(tmpdir(), `linkedin-profile-${Date.now()}.pdf`)
      item.setSavePath(outPath)

      item.on('done', (_e, state) => {
        if (state === 'completed') {
          succeed(outPath)
        } else {
          fail(`LinkedIn PDF download ${state}.`)
        }
      })
    })

    win.on('closed', () => {
      if (!settled) fail('Window closed before the profile PDF was downloaded.')
    })

    function handleNavigation(url: string): void {
      if (downloadTriggered || isAuthWall(url)) return

      // Once on the target profile, navigate to LinkedIn's save-to-pdf overlay
      // which triggers the download directly without any UI interaction needed
      if (getProfilePath(url) === resolvedProfilePath) {
        downloadTriggered = true
        const handle = resolvedProfilePath.replace('/in/', '')
        win.loadURL(`https://www.linkedin.com/in/${handle}/overlay/save-to-pdf/`)
        return
      }

      // LinkedIn redirected to the feed after login (full nav or SPA) — go to the profile
      if (url.includes('linkedin.com/feed') || url.includes('linkedin.com/?') || url === 'https://www.linkedin.com/') {
        win.loadURL(canonicalUrl)
      }
    }

    win.webContents.on('did-navigate', (_e, url) => handleNavigation(url))
    // LinkedIn is a SPA — post-login redirects often use pushState, not full navigations
    win.webContents.on('did-navigate-in-page', (_e, url) => handleNavigation(url))

    // Load the profile URL — LinkedIn will show login if not authenticated
    win.loadURL(canonicalUrl)
  })
}
