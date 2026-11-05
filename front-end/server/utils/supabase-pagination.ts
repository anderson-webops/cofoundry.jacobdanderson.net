interface Page<Row> {
  count: number | null
  data: Row[] | null
  error: unknown
}

const pageSize = 250

function appendVersionPage<Row extends { id: string }>(rows: Row[], currentRows: Row[], seenIds: Set<string>) {
  for (const row of currentRows) {
    if (seenIds.has(row.id))
      throw new Error("Version history changed during loading. Refresh and try again.")
    seenIds.add(row.id)
  }
  rows.push(...currentRows)
}

export async function collectStablePages<Row extends { id: string }>(readPage: (start: number, end: number) => Promise<Page<Row>>) {
  const rows: Row[] = []
  const seenIds = new Set<string>()
  let expectedCount: number | null = null

  while (true) {
    const page = await readPage(rows.length, rows.length + pageSize - 1)
    if (page.error)
      throw page.error
    if (page.count === null || !Number.isSafeInteger(page.count) || page.count < 0)
      throw new Error("Version history count is unavailable.")
    if (expectedCount !== null && page.count !== expectedCount)
      throw new Error("Version history changed during loading. Refresh and try again.")
    expectedCount = page.count

    const currentRows = page.data || []
    if (currentRows.length > pageSize || (!currentRows.length && rows.length < expectedCount))
      throw new Error("Version history page is incomplete.")
    appendVersionPage(rows, currentRows, seenIds)
    if (rows.length > expectedCount)
      throw new Error("Version history page exceeds the expected count.")
    if (rows.length === expectedCount)
      return rows
  }
}
