/**
 * GYM-7: Sync Notion Exercise select options + populate blank rows
 *
 * What this does:
 *   1. Adds all canonical notionNames from routines.ts as select options in the
 *      Notion DB Exercise field (if not already present).
 *   2. For every row where Exercise is blank, attempts to resolve the canonical
 *      name from the Entry field using the OLD→NEW mapping table.
 *   3. If an Entry value is ambiguous or unknown, flags it — does NOT patch it.
 *
 * Run: npx ts-node --project tsconfig.json -e "require('./scripts/gym7-sync-exercise-select')"
 * Or:  npx tsx scripts/gym7-sync-exercise-select.ts
 */

import { Client } from '@notionhq/client'
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const notion = new Client({ auth: process.env.NOTION_TOKEN })
const DATABASE_ID = process.env.NOTION_DATABASE_ID!

// ─── Canonical exercise names (from routines.ts notionName fields) ────────────
const CANONICAL_NAMES: string[] = [
  // Push
  'Wide-grip Barbell Bench Press',
  'Incline Dumbbell Press',
  'Seated Cable Fly',
  'Dumbbell Shoulder Press',
  'Side Lateral Raise',
  'Face Pull',
  'Triceps Pushdown - Rope Attachment',
  'Cable Rope Overhead Triceps Extension',
  // Pull
  'Cable Lat Pulldown',
  'Cable Seated Row (Wide Grip)',
  'Cable Seated Row (Close Grip)',
  'Standing Biceps Cable Curl',
  'Standing One-arm Cable Curl',
  'Preacher Hammer Dumbbell Curl',
  'Standing Palms-up Barbell Behind the Back Wrist Curl',
  // Legs
  'Linear Hack Press',
  'Leg Press',
  'Leg Extensions',
  'Seated Leg Curl',
  'Prone Leg Curl (Machine)',
  'Romanian Deadlift',
  'Standing Calf Raises',
  // Non-routine exercises needing canonical select options
  'Incline Dumbbell Curl',
  'Incline Dumbbell Flyes',
  'Cross Body Hammer Curl',
]

// ─── Old Notion name → canonical name mapping ────────────────────────────────
// Covers all known old select values AND common Entry text variations.
// Keys are lowercased for case-insensitive matching.
// Exercises not in the current routine keep their closest canonical name from exercises.json.
const OLD_TO_CANONICAL: Record<string, string> = {
  // Push
  'bench press':                                      'Wide-grip Barbell Bench Press',
  'barbell bench press':                              'Wide-grip Barbell Bench Press',
  'wide-grip barbell bench press':                    'Wide-grip Barbell Bench Press',
  'dumbbell incline press':                           'Incline Dumbbell Press',
  'incline dumbbell press':                           'Incline Dumbbell Press',
  'chest fly':                                        'Seated Cable Fly',
  'seated cable fly':                                 'Seated Cable Fly',
  'dumbbell incline flies':                           'Incline Dumbbell Flyes',
  'shoulder press':                                   'Dumbbell Shoulder Press',
  'dumbbell shoulder press':                          'Dumbbell Shoulder Press',
  'lateral raise':                                    'Side Lateral Raise',
  'side lateral raise':                               'Side Lateral Raise',
  'facepull':                                         'Face Pull',
  'face pull':                                        'Face Pull',
  'tricep vertical rope':                             'Triceps Pushdown - Rope Attachment',
  'triceps pushdown - rope attachment':               'Triceps Pushdown - Rope Attachment',
  'single-arm tricep pushdown':                       'Single-Arm Tricep Pushdown',
  'tricep rope horizontal':                           'Tricep rope horizontal',
  'tricep iso behind head':                           'Cable Rope Overhead Triceps Extension',
  'cable rope overhead triceps extension':            'Cable Rope Overhead Triceps Extension',
  'shoulder front':                                   'Shoulder front',
  // Pull
  'pulldown bar cable':                               'Cable Lat Pulldown',
  'lat pulldown red machine':                         'Cable Lat Pulldown',
  'mts front pulldown':                               'Cable Lat Pulldown',
  'cable lat pulldown':                               'Cable Lat Pulldown',
  'row cable wide grip':                              'Cable Seated Row (Wide Grip)',
  'cable seated row (wide grip)':                     'Cable Seated Row (Wide Grip)',
  'row cable close grip':                             'Cable Seated Row (Close Grip)',
  'cable seated row (close grip)':                    'Cable Seated Row (Close Grip)',
  'mts row':                                          'Cable Seated Row (Wide Grip)',
  'bicep ez bar':                                     'Standing Biceps Cable Curl',
  'cable curl (ez bar)':                              'Standing Biceps Cable Curl',
  'cable curl (ez bar) — wide grip':                  'Standing Biceps Cable Curl',
  'cable curl (ez bar) — close grip':                 'Standing Biceps Cable Curl',
  'standing biceps cable curl':                       'Standing Biceps Cable Curl',
  'rope iso curl from below':                         'Standing One-arm Cable Curl',
  'standing one-arm cable curl':                      'Standing One-arm Cable Curl',
  'incline dumbbell curl':                            'Incline Dumbbell Curl',
  'cross body curl':                                  'Cross Body Hammer Curl',
  'cross-body curl':                                  'Cross Body Hammer Curl',
  'hammer curl':                                      'Hammer curl',
  'single-arm preacher hammer curl':                  'Preacher Hammer Dumbbell Curl',
  'preacher hammer dumbbell curl':                    'Preacher Hammer Dumbbell Curl',
  'forearm behind back':                              'Standing Palms-up Barbell Behind the Back Wrist Curl',
  'forearm palm up':                                  'Standing Palms-up Barbell Behind the Back Wrist Curl',
  'standing palms-up barbell behind the back wrist curl': 'Standing Palms-up Barbell Behind the Back Wrist Curl',
  // Legs
  'linear hack press':                                'Linear Hack Press',
  'linear hack press or squat':                       'Linear Hack Press',
  'leg press pendular':                               'Leg Press',
  'leg press':                                        'Leg Press',
  'leg extension':                                    'Leg Extensions',
  'leg extensions':                                   'Leg Extensions',
  'leg curl':                                         'Seated Leg Curl',
  'seated leg curl':                                  'Seated Leg Curl',
  'prone leg curl':                                   'Prone Leg Curl (Machine)',
  'romanian deadlift':                                'Romanian Deadlift',
  'dumbbell romanian deadlift':                       'Romanian Deadlift',
  'standing calf raise':                              'Standing Calf Raises',
  'standing calf raises':                             'Standing Calf Raises',
  'calves':                                           'Standing Calf Raises',
}

// ─── Step 1: Ensure all canonical names exist as select options ───────────────
async function ensureSelectOptions(existingOptions: string[]): Promise<void> {
  const existingLower = existingOptions.map(o => o.toLowerCase())
  const missing = CANONICAL_NAMES.filter(
    name => !existingLower.includes(name.toLowerCase())
  )

  if (missing.length === 0) {
    console.log('✅ All canonical names already exist as select options.')
    return
  }

  console.log(`\nAdding ${missing.length} missing select options:`)
  missing.forEach(name => console.log(`  + ${name}`))

  // Fetch current DB schema to get all existing options
  const db = await notion.databases.retrieve({ database_id: DATABASE_ID }) as any
  const currentOptions: { name: string; color: string }[] =
    db.properties['Exercise']?.select?.options ?? []

  const updatedOptions = [
    ...currentOptions,
    ...missing.map(name => ({ name, color: 'default' as const })),
  ]

  await notion.databases.update({
    database_id: DATABASE_ID,
    properties: {
      Exercise: {
        select: { options: updatedOptions },
      },
    } as any,
  })

  console.log('✅ Select options updated.')
}

// ─── Strip known Entry suffixes to extract base exercise name ────────────────
// Entry field was used in multiple formats historically:
//   "Exercise Name — Set N"
//   "Exercise Name — 3xN"
//   "Exercise Name, weightxreps"
function extractBaseExerciseName(entry: string): string {
  return entry
    .replace(/\s*—\s*set\s*\d+$/i, '')       // "— Set 3"
    .replace(/\s*—\s*\d+x[\d–-]+$/i, '')     // "— 3x12"
    .replace(/,\s*[\d.]+x[\d]+$/i, '')        // ", 50x12"
    .trim()
}

// ─── Step 2: Query all rows, find blank Exercise, resolve and patch ───────────
async function backfillBlankRows(dryRun: boolean): Promise<void> {
  console.log('\n── Scanning rows for blank Exercise field... ──\n')

  const allPages: any[] = []
  let cursor: string | undefined

  // Paginate through all rows
  do {
    const response: any = await notion.databases.query({
      database_id: DATABASE_ID,
      page_size: 100,
      ...(cursor ? { start_cursor: cursor } : {}),
    })
    allPages.push(...response.results)
    cursor = response.has_more ? response.next_cursor : undefined
  } while (cursor)

  console.log(`Total rows fetched: ${allPages.length}`)

  const blankRows = allPages.filter(
    (page: any) => !page.properties['Exercise']?.select?.name
  )

  console.log(`Rows with blank Exercise: ${blankRows.length}\n`)

  if (blankRows.length === 0) {
    console.log('✅ No blank rows found.')
    return
  }

  const patched: { id: string; entry: string; resolvedTo: string }[] = []
  const flagged: { id: string; entry: string; reason: string }[] = []

  for (const page of blankRows) {
    const pageId: string = page.id
    const entry: string =
      page.properties['Entry']?.title?.[0]?.plain_text?.trim() ?? ''

    if (!entry) {
      flagged.push({ id: pageId, entry: '(empty)', reason: 'No Entry value — cannot resolve' })
      continue
    }

    const baseName = extractBaseExerciseName(entry)
    const canonical = OLD_TO_CANONICAL[baseName.toLowerCase()]

    if (!canonical) {
      flagged.push({ id: pageId, entry, reason: `Base name "${baseName}" not in mapping table — needs manual review` })
      continue
    }

    if (!dryRun) {
      try {
        await notion.pages.update({
          page_id: pageId,
          properties: {
            Exercise: { select: { name: canonical } },
          },
        })
        patched.push({ id: pageId, entry, resolvedTo: canonical })
      } catch (err: any) {
        flagged.push({ id: pageId, entry, reason: `API error: ${err.message}` })
      }
    } else {
      patched.push({ id: pageId, entry, resolvedTo: canonical })
    }
  }

  // ─── Report ───────────────────────────────────────────────────────────────
  const prefix = dryRun ? '[DRY RUN] Would patch' : 'Patched'
  console.log(`${prefix} ${patched.length} rows:\n`)
  patched.forEach(r => console.log(`  ✅  "${r.entry}" → "${r.resolvedTo}"  (${r.id})`))

  if (flagged.length > 0) {
    console.log(`\n⚠️  ${flagged.length} rows flagged for manual review:\n`)
    flagged.forEach(r =>
      console.log(`  ⚠️   Entry: "${r.entry}"\n       Reason: ${r.reason}\n       Page: ${r.id}\n`)
    )
  }

  // Write report to file
  const report = {
    runAt: new Date().toISOString(),
    dryRun,
    totalRows: allPages.length,
    blankRows: blankRows.length,
    patched,
    flagged,
  }
  const reportPath = path.resolve(__dirname, '../gym7-sync-report.json')
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
  console.log(`\nReport written to gym7-sync-report.json`)
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2)
  const dryRun = !args.includes('--execute')

  console.log(`\n🏋️  GYM-7: Notion Exercise Sync`)
  console.log(`Mode: ${dryRun ? 'DRY RUN (pass --execute to apply changes)' : 'LIVE — writing to Notion'}\n`)

  if (!process.env.NOTION_TOKEN || !DATABASE_ID) {
    console.error('❌ NOTION_TOKEN or NOTION_DATABASE_ID missing from .env.local')
    process.exit(1)
  }

  // Get existing options from DB schema
  const db = await notion.databases.retrieve({ database_id: DATABASE_ID }) as any
  const existingOptions: string[] = (db.properties['Exercise']?.select?.options ?? []).map(
    (o: any) => o.name
  )

  console.log(`Current select options in Notion (${existingOptions.length}): ${existingOptions.join(', ')}\n`)

  await ensureSelectOptions(existingOptions)
  await backfillBlankRows(dryRun)

  console.log('\n✅ Done.')
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
