#!/usr/bin/env node
/**
 * Cleanup pass: earlier manual replace of `bg-white ` → `bg-card`
 * ate a trailing space in places where a Tailwind class should have
 * followed. Also stitch any lingering `bg-white` stand-alones to `bg-card`.
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const TARGETS = ['src/app/(dashboard)', 'src/app/(auth)', 'src/components']

// Glue fixes (bg-card pasted into next class without space)
const FIXES = [
  [/bg-cardrounded-/g, 'bg-card rounded-'],
  [/bg-cardborder-/g, 'bg-card border-'],
  [/bg-cardflex-/g, 'bg-card flex-'],
  [/bg-cardflex /g, 'bg-card flex '],
  [/bg-cardshadow-/g, 'bg-card shadow-'],
  [/bg-cardshadow /g, 'bg-card shadow '],
  [/bg-cardp-/g, 'bg-card p-'],
  [/bg-cardpx-/g, 'bg-card px-'],
  [/bg-cardpy-/g, 'bg-card py-'],
  [/bg-cardmt-/g, 'bg-card mt-'],
  [/bg-cardmb-/g, 'bg-card mb-'],
  [/bg-cardmx-/g, 'bg-card mx-'],
  [/bg-cardmy-/g, 'bg-card my-'],
  [/bg-cardtext-/g, 'bg-card text-'],
  [/bg-cardw-/g, 'bg-card w-'],
  [/bg-cardh-/g, 'bg-card h-'],
  [/bg-cardhover:/g, 'bg-card hover:'],
  [/bg-cardtransition/g, 'bg-card transition'],
  [/bg-cardgroup/g, 'bg-card group'],
  [/bg-cardoverflow-/g, 'bg-card overflow-'],
  [/bg-cardmin-/g, 'bg-card min-'],
  [/bg-cardmax-/g, 'bg-card max-'],
  [/bg-cardspace-/g, 'bg-card space-'],
  [/bg-cardinline-/g, 'bg-card inline-'],
  [/bg-cardblock/g, 'bg-card block'],
  [/bg-cardring-/g, 'bg-card ring-'],
  [/bg-cardabsolute/g, 'bg-card absolute'],
  [/bg-cardrelative/g, 'bg-card relative'],
  [/bg-cardfixed/g, 'bg-card fixed'],
  [/bg-cardsticky/g, 'bg-card sticky'],
  [/bg-cardz-/g, 'bg-card z-'],
  [/bg-cardgap-/g, 'bg-card gap-'],
  [/bg-cardgrid/g, 'bg-card grid'],
  [/bg-cardfont-/g, 'bg-card font-'],
  [/bg-cardcursor-/g, 'bg-card cursor-'],
  [/bg-cardopacity-/g, 'bg-card opacity-'],
  [/bg-carddivide-/g, 'bg-card divide-'],
  // Regular standalone bg-white → bg-card (safe — login page uses bg-background instead)
  [/\bbg-white\b(?!\/)/g, 'bg-card'],
]

let filesChanged = 0
let totalFixes = 0

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (['node_modules', '.next', 'scripts'].includes(entry.name)) continue
      walk(full)
    } else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
      processFile(full)
    }
  }
}

function processFile(filePath) {
  const original = fs.readFileSync(filePath, 'utf8')
  let content = original
  let fixes = 0

  for (const [re, to] of FIXES) {
    const matches = content.match(re)
    if (matches) {
      fixes += matches.length
      content = content.replace(re, to)
    }
  }

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8')
    filesChanged++
    totalFixes += fixes
    console.log(`  ${path.relative(ROOT, filePath)} — ${fixes} fixes`)
  }
}

console.log('Fixing bg-card spacing bug + standalone bg-white...\n')
for (const target of TARGETS) {
  const full = path.join(ROOT, target)
  if (fs.existsSync(full)) walk(full)
}
console.log(`\nDone. Files changed: ${filesChanged}, total fixes: ${totalFixes}`)
