import { Client } from '@notionhq/client'
import { Split, Exercise } from './routines'

const notion = new Client({ auth: process.env.NOTION_TOKEN })
const DATABASE_ID = process.env.NOTION_DATABASE_ID!

export interface NotionEntry {
  exercise: string
  date: string
  split: Split
  weight: number
  set: number
  reps: number
  entry: string
  notes?: string
  unit?: 'Lbs' | 'Pins'
}

export interface SessionRecord {
  date: string
  exercises: {
    [exerciseName: string]: {
      sets: { set: number; weight: number; reps: number }[]
    }
  }
}

function extractExerciseName(props: any): string {
  // Exercise is a Select field
  return props['Exercise']?.select?.name ?? ''
}

function extractEntryName(props: any): string {
  // Entry is the Title field in Notion
  return props['Entry']?.title?.[0]?.plain_text ?? ''
}

// Fetch last N sessions for a given split
export async function fetchLastSessions(split: Split, maxSessions: number = 5): Promise<SessionRecord[]> {
  const response = await notion.databases.query({
    database_id: DATABASE_ID,
    filter: {
      property: 'Split',
      select: { equals: split },
    },
    sorts: [{ property: 'Date', direction: 'descending' }],
    page_size: 200,
  })

  const rows: NotionEntry[] = response.results.map((page: any) => {
    const props = page.properties
    return {
      exercise: extractExerciseName(props),
      date: props['Date']?.date?.start ?? '',
      split: props['Split']?.select?.name as Split,
      weight: props['Weight (Lbs)']?.number ?? 0,
      set: props['Set']?.number ?? 0,
      reps: props['Reps']?.number ?? 0,
      entry: extractEntryName(props),
    }
  })

  // Group by date, get last N unique dates
  const dateMap = new Map<string, NotionEntry[]>()
  for (const row of rows) {
    if (!row.date) continue
    if (!dateMap.has(row.date)) dateMap.set(row.date, [])
    dateMap.get(row.date)!.push(row)
  }

  const sortedDates = Array.from(dateMap.keys())
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
    .slice(0, maxSessions)

  return sortedDates.map(date => {
    const entries = dateMap.get(date)!
    const exercises: SessionRecord['exercises'] = {}
    for (const entry of entries) {
      if (!entry.exercise) continue
      if (!exercises[entry.exercise]) exercises[entry.exercise] = { sets: [] }
      exercises[entry.exercise].sets.push({
        set: entry.set,
        weight: entry.weight,
        reps: entry.reps,
      })
    }
    // Sort sets within each exercise
    for (const ex of Object.values(exercises)) {
      ex.sets.sort((a, b) => a.set - b.set)
    }
    return { date, exercises }
  })
}

// Fetch latest weights for all exercises — 3 queries total (one per split), no rate limit issues.
// For each exercise: scan back through its split's sessions (newest first), return the highest
// weight found on the first date that has a weight. Stop after 3 distinct split dates with no
// weight found (covers skipped sessions). Max lookback = 3 past routines per split.
export async function fetchAllLatestWeights(exercises: Exercise[]): Promise<Record<string, number | null>> {
  const splits: Split[] = ['Push', 'Pull', 'Legs']

  // Build lookups
  const notionToDisplay: Record<string, string> = {}
  const exerciseBySplit: Record<Split, Exercise[]> = { Push: [], Pull: [], Legs: [] }
  for (const ex of exercises) {
    notionToDisplay[ex.notionName] = ex.name
    exerciseBySplit[ex.split].push(ex)
  }

  // One query per split, fetch recent entries sorted newest-first
  const splitRowMap: Record<Split, any[]> = { Push: [], Pull: [], Legs: [] }
  await Promise.all(
    splits.map(async (split) => {
      try {
        const response = await notion.databases.query({
          database_id: DATABASE_ID,
          filter: { property: 'Split', select: { equals: split } },
          sorts: [{ property: 'Date', direction: 'descending' }],
          page_size: 200,
        })
        splitRowMap[split] = response.results as any[]
      } catch (err) {
        console.error(`Failed to fetch weights for split "${split}":`, err)
      }
    })
  )

  const MAX_DATES = 3
  const results: Record<string, number | null> = {}

  for (const split of splits) {
    const rows = splitRowMap[split]

    // Collect all unique dates for this split (already sorted newest-first from Notion)
    const splitDates: string[] = []
    for (const page of rows) {
      const date: string = page.properties['Date']?.date?.start ?? ''
      if (date && !splitDates.includes(date)) splitDates.push(date)
    }

    // Group all rows by date for fast lookup
    const rowsByDate: Record<string, any[]> = {}
    for (const page of rows) {
      const date: string = page.properties['Date']?.date?.start ?? ''
      if (!date) continue
      if (!rowsByDate[date]) rowsByDate[date] = []
      rowsByDate[date].push(page)
    }

    // For each exercise in this split, walk dates newest→oldest, up to MAX_DATES
    for (const ex of exerciseBySplit[split]) {
      let found: number | null = null
      let datesScanned = 0

      for (const date of splitDates) {
        if (datesScanned >= MAX_DATES) break

        const dateRows = rowsByDate[date] ?? []
        // Check if this date has any entry for this exercise's split (counts as a routine date)
        // even if this specific exercise wasn't logged that day
        const splitDateHasEntries = dateRows.length > 0
        if (!splitDateHasEntries) continue

        datesScanned++

        // Look for this exercise specifically on this date
        let maxWeightOnDate: number | null = null
        for (const page of dateRows) {
          const notionName: string = page.properties['Exercise']?.select?.name ?? ''
          if (notionName !== ex.notionName) continue
          const weight: number | null = page.properties['Weight (Lbs)']?.number ?? null
          if (weight !== null && weight > 0) {
            maxWeightOnDate = maxWeightOnDate === null ? weight : Math.max(maxWeightOnDate, weight)
          }
        }

        if (maxWeightOnDate !== null) {
          found = maxWeightOnDate
          break
        }
        // No weight found on this date — keep scanning (up to MAX_DATES)
      }

      results[ex.name] = found
    }
  }

  return results
}

// Write a set entry to Notion — returns the created page ID
export async function writeSessionEntry(entry: NotionEntry): Promise<string> {
  const properties: any = {
    Entry: { title: [{ text: { content: entry.entry } }] },
    Exercise: { select: { name: entry.exercise } },
    Date: { date: { start: entry.date } },
    Split: { select: { name: entry.split } },
    'Weight (Lbs)': { number: entry.weight },
    Set: { number: entry.set },
    Reps: { number: entry.reps },
  }
  if (entry.notes) {
    properties['Notes'] = { rich_text: [{ text: { content: entry.notes } }] }
  }
  if (entry.unit) {
    properties['Unit'] = { select: { name: entry.unit } }
  }
  const page = await notion.pages.create({
    parent: { database_id: DATABASE_ID },
    properties,
  })
  return page.id
}

// Write multiple entries in parallel — returns array of page IDs in same order
export async function writeSessionEntries(entries: NotionEntry[]): Promise<string[]> {
  return Promise.all(entries.map(writeSessionEntry))
}

// Update an existing Notion page with changed values
export async function updateSessionEntry(
  pageId: string,
  changes: { weight?: number; reps?: number; notes?: string }
): Promise<void> {
  const properties: any = {}
  if (changes.weight !== undefined) properties['Weight (Lbs)'] = { number: changes.weight }
  if (changes.reps !== undefined) properties['Reps'] = { number: changes.reps }
  if (changes.notes !== undefined) {
    properties['Notes'] = { rich_text: [{ text: { content: changes.notes } }] }
  }
  if (Object.keys(properties).length === 0) return
  await notion.pages.update({ page_id: pageId, properties })
}
