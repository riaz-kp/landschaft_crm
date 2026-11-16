import type { AreaItem, ID, Material, Quotation } from './types'

/** One place a material is used: an item on a BOQ or quotation. */
export interface MaterialUse {
  quote: Quotation
  area: string
  item: AreaItem
}

/**
 * A row of the Materials page: a material added by hand, the items with the
 * same name and size found on BOQs and quotations, or both together.
 */
export interface MaterialRow {
  key: string
  name: string
  dimension?: string
  unit: string
  specification?: string
  /** The library's photo, else the latest photo a BOQ or quotation gave the item. */
  image?: string
  /** The rate recorded in the library, else the latest rate a quotation gave it. */
  rate?: number
  rateFrom?: 'library' | Quotation
  record?: Material
  uses: MaterialUse[]
  /** Every project it is used on: the library's list and the projects of the documents it appears in. */
  projectIds: ID[]
}

const squash = (text?: string) => (text ?? '').trim().toLowerCase().replace(/\s+/g, ' ')

/** Name and size, ignoring case and spacing — "Bangalore stone 1x4" and "Bangalore Stone · 1 x 4" match. */
export function materialKey(name: string, dimension?: string): string {
  return `${squash(name)}|${squash(dimension).replace(/\s*[x×*]\s*/g, 'x')}`
}

/** The library and every BOQ and quotation item, merged by name and size, A to Z. */
export function materialRows(records: Material[], quotations: Quotation[]): MaterialRow[] {
  const rows = new Map<string, MaterialRow>()
  const rowFor = (key: string, seed: Omit<MaterialRow, 'key' | 'uses' | 'projectIds'>) => {
    let row = rows.get(key)
    if (!row) {
      row = { key, ...seed, uses: [], projectIds: [] }
      rows.set(key, row)
    }
    return row
  }

  for (const record of records) {
    const row = rowFor(materialKey(record.name, record.dimension), {
      name: record.name, dimension: record.dimension, unit: record.unit, specification: record.specification,
    })
    row.record = record
    row.name = record.name
    row.dimension = record.dimension
    row.unit = record.unit
    row.specification = record.specification || row.specification
    row.image = record.image || row.image
    if (record.rate) {
      row.rate = record.rate
      row.rateFrom = 'library'
    }
    row.projectIds.push(...record.projectIds)
  }

  // Oldest first, so the latest document's specification and rate win.
  const byDate = [...quotations].sort((a, b) => a.date.localeCompare(b.date))
  for (const quote of byDate) {
    for (const area of quote.areas ?? []) {
      for (const item of area.items) {
        if (!item.item.trim()) continue
        const row = rowFor(materialKey(item.item, item.dimension), {
          name: item.item.trim(), dimension: item.dimension?.trim() || undefined, unit: item.unit,
        })
        row.uses.push({ quote, area: area.name, item })
        row.projectIds.push(quote.projectId)
        if (!row.record) {
          row.specification = item.specification || row.specification
          row.unit = item.unit || row.unit
        }
        if (item.image && !row.record?.image) row.image = item.image
        if (quote.kind === 'Quotation' && item.rate && row.rateFrom !== 'library') {
          row.rate = item.rate
          row.rateFrom = quote
        }
      }
    }
  }

  return [...rows.values()]
    .map((row) => ({ ...row, projectIds: [...new Set(row.projectIds)] }))
    .sort((a, b) => a.name.localeCompare(b.name) || (a.dimension ?? '').localeCompare(b.dimension ?? ''))
}
