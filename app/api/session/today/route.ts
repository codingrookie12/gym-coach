import { NextResponse } from 'next/server'
import { Client } from '@notionhq/client'
import { Split } from '@/lib/routines'

const notion = new Client({ auth: process.env.NOTION_TOKEN })
const DATABASE_ID = process.env.NOTION_DATABASE_ID!

// Check if there are any entries for today across all splits.
// Returns { split, entryCount } for the split with the most entries today,
// or null if nothing logged today.
export async function GET() {
  const today = new Date().toISOString().split('T')[0]

  try {
    const response = await notion.databases.query({
      database_id: DATABASE_ID,
      filter: {
        property: 'Date',
        date: { equals: today },
      },
      page_size: 100,
    })

    if (response.results.length === 0) {
      return NextResponse.json({ found: false })
    }

    // Count entries per split
    const counts: Record<string, number> = {}
    for (const page of response.results as any[]) {
      const split = page.properties['Split']?.select?.name
      if (split) counts[split] = (counts[split] ?? 0) + 1
    }

    // Return the split with the most entries
    const topSplit = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
    return NextResponse.json({
      found: true,
      split: topSplit[0] as Split,
      entryCount: topSplit[1],
    })
  } catch (error) {
    console.error('Today check error:', error)
    return NextResponse.json({ found: false })
  }
}
