import { NextResponse } from 'next/server'

const REPO = 'Giridharan0624/taskflow-desktop-rust'
const RELEASES_LATEST_API = `https://api.github.com/repos/${REPO}/releases/latest`

// Cache GitHub's response for 10 minutes at the edge. This protects us from
// the 60-req/hour unauthenticated GitHub API rate limit while still picking
// up new releases quickly.
export const revalidate = 600

// Returns the latest desktop app version from GitHub Releases, e.g.
// { version: "1.2.0" }. Downloads themselves go through
// /api/download/[platform]; this endpoint exists only so the dashboard and
// profile can show the current version WITHOUT depending on any S3/CloudFront
// manifest — GitHub Releases is the single source of truth.
export async function GET() {
  try {
    const response = await fetch(RELEASES_LATEST_API, {
      headers: { Accept: 'application/vnd.github+json' },
      next: { revalidate },
    })

    if (!response.ok) {
      return NextResponse.json({ version: null }, { status: 200 })
    }

    const release: { tag_name?: string } = await response.json()
    const version = (release.tag_name || '').replace(/^v/, '') || null
    return NextResponse.json({ version }, { status: 200 })
  } catch {
    return NextResponse.json({ version: null }, { status: 200 })
  }
}
