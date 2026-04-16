import { Client } from '@notionhq/client'
import { Split } from './routines'

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

// Fetch latest weights for all exercises
export async function fetchAllLatestWeights(exerciseNames: string[]): Promise<Record<string, number | null>> {
  const results: Record<string, number | null> = {}

  const response = await notion.databases.query({
    database_id: DATABASE_ID,
    sorts: [{ property: 'Date', direction: 'descending' }],
    page_size: 500,
  })

  const seen = new Set<string>()
  for (const page of response.results as any[]) {
    // Exercise is a Select field
    const exerciseName = page.properties['Exercise']?.select?.name
    if (!exerciseName || seen.has(exerciseName)) continue
    const weight = page.properties['Weight (Lbs)']?.number
    if (weight !== null && weight !== undefined) {
      results[exerciseName] = weight
      seen.add(exerciseName)
    }
  }

  for (const name of exerciseNames) {
    if (!(name in results)) results[name] = null
  }
  return results
}

// Write a set entry to Notion
export async function writeSessionEntry(entry: NotionEntry): Promise<void> {
  await notion.pages.create({
    parent: { database_id: DATABASE_ID },
    properties: {
      // Entry is the Title field
      Entry: { title: [{ text: { content: entry.entry } }] },
      // Exercise is a Select field
      Exercise: { select: { name: entry.exercise } },
      Date: { date: { start: entry.date } },
      Split: { select: { name: entry.split } },
      'Weight (Lbs)': { number: entry.weight },
      Set: { number: entry.set },
      Reps: { number: entry.reps },
    },
  })
}

// Write multiple entries in parallel (for session finish)
export async function writeSessionEntries(entries: NotionEntry[]): Promise<void> {
  await Promise.all(entries.map(writeSessionEntry))
}
