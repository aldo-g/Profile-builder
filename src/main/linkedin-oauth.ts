import { shell } from 'electron'
import { createServer } from 'http'
import { randomBytes } from 'crypto'

const REDIRECT_PORT = 57842
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}`

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

export interface LinkedInProfile {
  sub: string
  name: string
  given_name: string
  family_name: string
  email: string
  picture?: string
  locale?: { country: string; language: string }
}

export function linkedInOAuth(): Promise<LinkedInProfile> {
  const CLIENT_ID = process.env.LINKEDIN_CLIENT_ID
  if (!CLIENT_ID) throw new Error('LINKEDIN_CLIENT_ID is not set')

  return new Promise((resolve, reject) => {
    const state = base64url(randomBytes(16))

    let settled = false
    function fail(msg: string): void {
      if (settled) return
      settled = true
      server.close()
      reject(new Error(msg))
    }

    // Temporary local server to catch the OAuth callback
    const server = createServer(async (req, res) => {
      const url = new URL(req.url ?? '/', `http://localhost:${REDIRECT_PORT}`)

      if (url.pathname !== '/') {
        res.writeHead(404)
        res.end()
        return
      }

      const error = url.searchParams.get('error')
      if (error) {
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end('<html><body><p>LinkedIn sign-in was cancelled. You can close this tab.</p></body></html>')
        fail(`LinkedIn OAuth error: ${url.searchParams.get('error_description') ?? error}`)
        return
      }

      const returnedState = url.searchParams.get('state')
      const code = url.searchParams.get('code')

      if (returnedState !== state || !code) {
        res.writeHead(400, { 'Content-Type': 'text/html' })
        res.end('<html><body><p>Invalid response. You can close this tab.</p></body></html>')
        fail('OAuth state mismatch or missing code')
        return
      }

      // Exchange code for token
      try {
        const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: REDIRECT_URI,
            client_id: CLIENT_ID,
            client_secret: process.env.LINKEDIN_CLIENT_SECRET!
          })
        })

        if (!tokenRes.ok) {
          const body = await tokenRes.text()
          throw new Error(`Token exchange failed: ${body}`)
        }

        const { access_token } = await tokenRes.json() as { access_token: string }

        // Fetch userinfo via OpenID Connect
        const userRes = await fetch('https://api.linkedin.com/v2/userinfo', {
          headers: { Authorization: `Bearer ${access_token}` }
        })

        if (!userRes.ok) {
          throw new Error(`Userinfo fetch failed: ${userRes.status}`)
        }

        const profile = await userRes.json() as LinkedInProfile

        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end('<html><body><p>Signed in successfully! You can close this tab and return to Profile Builder.</p></body></html>')

        if (!settled) {
          settled = true
          server.close()
          resolve(profile)
        }
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/html' })
        res.end('<html><body><p>Something went wrong. Please try again.</p></body></html>')
        fail(err instanceof Error ? err.message : 'Unknown error during token exchange')
      }
    })

    server.listen(REDIRECT_PORT, '127.0.0.1', () => {
      const authUrl = new URL('https://www.linkedin.com/oauth/v2/authorization')
      authUrl.searchParams.set('response_type', 'code')
      authUrl.searchParams.set('client_id', CLIENT_ID)
      authUrl.searchParams.set('redirect_uri', REDIRECT_URI)
      authUrl.searchParams.set('state', state)
      authUrl.searchParams.set('scope', 'openid profile email')

      shell.openExternal(authUrl.toString())
    })

    server.on('error', (err) => {
      fail(`Could not start local OAuth server: ${err.message}`)
    })

    // Timeout after 5 minutes
    setTimeout(() => fail('LinkedIn sign-in timed out.'), 5 * 60 * 1000)
  })
}
