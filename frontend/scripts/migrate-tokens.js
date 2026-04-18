#!/usr/bin/env node
/**
 * One-shot token migration for shadcn/Tailwind refactor.
 * Sweeps hard-coded gray/white classes to semantic tokens so
 * components respect the new theme and dark mode out of the box.
 *
 * Idempotent: running twice is a no-op.
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const TARGETS = [
  'src/app/(dashboard)',
  'src/app/(auth)',
  'src/components',
]

// Order matters — longer/more specific patterns first to avoid
// partial overlaps. All patterns are whole class names, matched
// by a word-boundary regex so we don't touch arbitrary strings.
const REPLACEMENTS = [
  // Text colors
  ['text-gray-900', 'text-foreground'],
  ['text-gray-800', 'text-foreground/95'],
  ['text-gray-700', 'text-foreground/85'],
  ['text-gray-600', 'text-muted-foreground'],
  ['text-gray-500', 'text-muted-foreground'],
  ['text-gray-400', 'text-muted-foreground/70'],
  ['text-gray-300', 'text-muted-foreground/50'],
  // Backgrounds
  ['hover:bg-gray-50/80', 'hover:bg-muted/40'],
  ['hover:bg-gray-50/70', 'hover:bg-muted/40'],
  ['hover:bg-gray-50/60', 'hover:bg-muted/40'],
  ['hover:bg-gray-50/50', 'hover:bg-muted/30'],
  ['hover:bg-gray-50', 'hover:bg-muted/40'],
  ['hover:bg-gray-100/60', 'hover:bg-muted/60'],
  ['hover:bg-gray-100', 'hover:bg-muted'],
  ['bg-gray-50/80', 'bg-muted/40'],
  ['bg-gray-50/70', 'bg-muted/40'],
  ['bg-gray-50/60', 'bg-muted/40'],
  ['bg-gray-50/50', 'bg-muted/30'],
  ['bg-gray-50/30', 'bg-muted/20'],
  ['bg-gray-50', 'bg-muted/40'],
  ['bg-gray-100/50', 'bg-muted/50'],
  ['bg-gray-100', 'bg-muted'],
  ['bg-gray-200', 'bg-muted'],
  ['bg-white/80', 'bg-card/80'],
  ['bg-white/60', 'bg-card/60'],
  ['bg-white/50', 'bg-card/50'],
  // Don't rewrite `bg-white` standalone — LoginForm-style glass cards keep it intentional.
  // But inside a card, `bg-white` is meant as surface.
  // Borders
  ['hover:border-gray-200', 'hover:border-border/80'],
  ['hover:border-gray-300', 'hover:border-border'],
  ['border-gray-50', 'border-border/50'],
  ['border-gray-100', 'border-border'],
  ['border-gray-200', 'border-border/80'],
  ['border-gray-300', 'border-border'],
  // Divides
  ['divide-gray-50', 'divide-border/60'],
  ['divide-gray-100', 'divide-border/80'],
  // Rings
  ['ring-gray-200/50', 'ring-border/60'],
  ['ring-gray-200', 'ring-border/80'],
]

let filesChanged = 0
let totalReplacements = 0

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      // Skip known non-source dirs
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
  let replacements = 0

  for (const [from, to] of REPLACEMENTS) {
    // Class-name boundary regex: preceded by start, whitespace, quote, backtick, or colon
    //                          followed by whitespace, quote, backtick, or end
    const escaped = from.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
    const re = new RegExp(`(^|[\\s"'\`:])(${escaped})(?=[\\s"'\`\\]}]|$)`, 'g')
    const before = content
    content = content.replace(re, (_m, prefix) => {
      replacements++
      return prefix + to
    })
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _ = before // silence lint
  }

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8')
    filesChanged++
    totalReplacements += replacements
    console.log(`  ${path.relative(ROOT, filePath)} — ${replacements} replacements`)
  }
}

console.log('Running token migration...\n')
for (const target of TARGETS) {
  const full = path.join(ROOT, target)
  if (fs.existsSync(full)) {
    walk(full)
  }
}
console.log(`\nDone. Files changed: ${filesChanged}, total replacements: ${totalReplacements}`)
