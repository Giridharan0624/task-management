import { NextResponse } from 'next/server'

const REPO = 'Giridharan0624/taskflow-desktop'
const RELEASES_LATEST_API = `https://api.github.com/repos/${REPO}/releases/latest`
const RELEASES_PAGE = `https://github.com/${REPO}/releases/latest`

// Cache GitHub's response for 10 minutes at the edge. This protects us from
// the 60-req/hour unauthenticated GitHub API rate limit while still picking
// up new releases quickly.
export const revalidate = 600

interface GitHubAsset {
  name: string
  browser_download_url: string
}

interface GitHubRelease {
  assets: GitHubAsset[]
}

type Platform = 'windows' | 'macos' | 'linux'

// Each platform has one or more asset-name patterns we look for, in priority
// order. First match wins. The regexes are intentionally loose so they survive
// version-number changes and minor naming tweaks.
//
// Linux has two shipping artifacts: a Debian package and an AppImage. Callers
// select between them with ?format=deb or ?format=appimage. Omitting the
// param falls back to the default order, which picks the .deb first since
// Ubuntu/Debian covers the majority of Linux users.
const PLATFORM_MATCHERS: Record<Platform, RegExp[]> = {
  windows: [/setup.*\.exe$/i, /\.exe$/i, /\.msi$/i],
  macos: [/\.dmg$/i, /\.pkg$/i, /darwin.*\.zip$/i],
  linux: [/\.deb$/i, /\.appimage$/i, /\.rpm$/i, /linux.*\.tar\.gz$/i],
}

const LINUX_FORMAT_MATCHERS: Record<string, RegExp[]> = {
  deb: [/\.deb$/i],
  appimage: [/\.appimage$/i],
  rpm: [/\.rpm$/i],
}

function isPlatform(value: string): value is Platform {
  return value === 'windows' || value === 'macos' || value === 'linux'
}

export async function GET(
  request: Request,
  context: { params: Promise<{ platform: string }> }
) {
  const { platform } = await context.params

  if (!isPlatform(platform)) {
    return NextResponse.redirect(RELEASES_PAGE, { status: 302 })
  }

  try {
    const response = await fetch(RELEASES_LATEST_API, {
      headers: { Accept: 'application/vnd.github+json' },
      next: { revalidate },
    })

    if (!response.ok) {
      return NextResponse.redirect(RELEASES_PAGE, { status: 302 })
    }

    const release: GitHubRelease = await response.json()

    // Resolve matcher list — Linux supports a per-format override so the
    // page can surface both .deb and .AppImage without a separate route.
    let matchers = PLATFORM_MATCHERS[platform]
    if (platform === 'linux') {
      const format = new URL(request.url).searchParams.get('format')
      if (format && LINUX_FORMAT_MATCHERS[format]) {
        matchers = LINUX_FORMAT_MATCHERS[format]
      }
    }

    for (const regex of matchers) {
      const asset = release.assets.find((a) => regex.test(a.name))
      if (asset) {
        return NextResponse.redirect(asset.browser_download_url, { status: 302 })
      }
    }

    // No asset matched — send the visitor to the releases page so they can
    // pick something manually rather than seeing a dead link.
    return NextResponse.redirect(RELEASES_PAGE, { status: 302 })
  } catch {
    return NextResponse.redirect(RELEASES_PAGE, { status: 302 })
  }
}
