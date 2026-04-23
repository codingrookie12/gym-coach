// GYM-23: Export full Notion Gym Progress DB snapshot to CSV
// Run: node scripts/gym23-export-notion-snapshot.mjs
import { Client } from '@notionhq/client'
import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const NOTION_TOKEN = process.env.NOTION_TOKEN
const DATABASE_ID  = process.env.NOTION_DATABASE_ID

if (!NOTION_TOKEN || !DATABASE_ID) {
  console.error('Missing NOTION_TOKEN or NOTION_DATABASE_ID in environment.')
  console.error('Run with: NOTION_TOKEN=... NOTION_DATABASE_ID=... node scripts/gym23-export-notion-snapshot.mjs')
  console.error('Or set them in .env.local and use: node --env-file=.env.local scripts/gym23-export-notion-snapshot.mjs')
  process.exit(1)
}

const notion = new Client({ auth: NOTION_TOKEN })

function escape(val) {
  if (val === null || val === undefined) return ''
  const s = String(val)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

async function fetchAllPages() {
  const pages = []
  let cursor = undefined
  do {
    const res = await notion.databases.query({
      database_id: DATABASE_ID,
      start_cursor: cursor,
      page_size: 100,
    })
    pages.push(...res.results)
    cursor = res.has_more ? res.next_cursor : undefined
  } while (cursor)
  return pages
}

function extractRow(page) {
  const p = page.properties
  return {
    page_id:  page.id,
    entry:    p['Entry']?.title?.[0]?.plain_text ?? '',
    exercise: p['Exercise']?.select?.name ?? '',
    date:     p['Date']?.date?.start ?? '',
    split:    p['Split']?.select?.name ?? '',
    weight:   p['Weight (Lbs)']?.number ?? '',
    set:      p['Set']?.number ?? '',
    reps:     p['Reps']?.number ?? '',
    unit:     p['Unit']?.select?.name ?? '',
    notes:    p['Notes']?.rich_text?.[0]?.plain_text ?? '',
    created:  page.created_time,
    last_edited: page.last_edited_time,
  }
}

const HEADERS = ['page_id','entry','exercise','date','split','weight','set','reps','unit','notes','created','last_edited']

async function main() {
  console.log('Fetching all pages from Notion database…')
  const pages = await fetchAllPages()
  console.log(`Fetched ${pages.length} rows.`)

  const rows = pages.map(extractRow)
  const csv = [
    HEADERS.join(','),
    ...rows.map(r => HEADERS.map(h => escape(r[h])).join(','))
  ].join('\n')

  const date = new Date().toISOString().split('T')[0]
  const filename = `notion-gym-progress-${date}.csv`
  const outPath = join(ROOT, 'exports', filename)
  writeFileSync(outPath, csv, 'utf8')

  console.log(`\n✓ Saved: exports/${filename}`)
  console.log(`✓ Row count: ${rows.length}`)
  console.log('\nSample (first 3 rows):')
  rows.slice(0, 3).forEach(r => console.log(JSON.stringify(r)))
}

main().catch(err => { console.error(err); process.exit(1) })
