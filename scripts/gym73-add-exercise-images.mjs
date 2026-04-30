/**
 * gym73-add-exercise-images.mjs
 *
 * One-time (idempotent) script: adds image paths to lib/exercises.json
 * by matching against the free-exercise-db source dataset.
 *
 * Source images are served via CDN:
 *   https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/{path}
 *
 * Run: node scripts/gym73-add-exercise-images.mjs
 */

import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

// ─── Load data ────────────────────────────────────────────────────────────────

const sourcePath = resolve(root, 'free-exercise-db-main/dist/exercises.json')
const appPath = resolve(root, 'lib/exercises.json')

const source = JSON.parse(readFileSync(sourcePath, 'utf8'))
const app = JSON.parse(readFileSync(appPath, 'utf8'))

// ─── Build normalized lookup: lowercase name → source exercise ────────────────

const sourceByNorm = new Map()
for (const ex of source) {
  if (ex.name) {
    sourceByNorm.set(ex.name.toLowerCase(), ex)
  }
}

// ─── Match and annotate ───────────────────────────────────────────────────────

let matched = 0
let alreadyHad = 0
let unmatched = 0
const unmatchedNames = []

for (const ex of app) {
  if (ex.images && ex.images.length > 0) {
    alreadyHad++
    continue
  }

  const sourceEx = sourceByNorm.get(ex.name.toLowerCase())
  if (sourceEx && sourceEx.images && sourceEx.images.length > 0) {
    ex.images = sourceEx.images
    matched++
  } else {
    unmatched++
    unmatchedNames.push(ex.name)
  }
}

// ─── Write updated exercises.json ─────────────────────────────────────────────

writeFileSync(appPath, JSON.stringify(app, null, 2), 'utf8')

// ─── Report ───────────────────────────────────────────────────────────────────

console.log(`\n✅ Exercise images updated\n`)
console.log(`  Matched:        ${matched}`)
console.log(`  Already had:    ${alreadyHad}`)
console.log(`  No source match: ${unmatched}`)

if (unmatchedNames.length > 0 && unmatchedNames.length <= 30) {
  console.log(`\n  Unmatched exercises (no images will show):`)
  for (const name of unmatchedNames) {
    console.log(`    - ${name}`)
  }
} else if (unmatchedNames.length > 30) {
  console.log(`\n  (${unmatchedNames.length} unmatched — run with DEBUG=1 to list all)`)
}
