import writeXlsxFile from 'write-excel-file/browser'
import type { Cell, Row } from 'write-excel-file/browser'

export type ExportValue = string | number | boolean | Date | null | undefined

export interface ExportColumn<T> {
  header: string
  value: (row: T) => ExportValue
  /** Column width in characters. */
  width?: number
  /** Excel number format, e.g. "#,##0" for rupees. */
  format?: string
}

export interface ExportSheet<T> {
  name: string
  rows: T[]
  columns: ExportColumn<T>[]
}

/** An ISO date as a real Excel date (midnight UTC, so it lands on the right day in every timezone). */
export function excelDate(iso?: string): Date | undefined {
  if (!iso) return undefined
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

export const RUPEES = '#,##0'

function cell(value: ExportValue, format?: string): Cell {
  if (value === null || value === undefined || value === '') return null
  if (value instanceof Date) return { value, type: Date, format: format ?? 'dd/mm/yyyy' }
  if (typeof value === 'number') return { value, type: Number, format }
  if (typeof value === 'boolean') return { value: value ? 'Yes' : 'No', type: String }
  return { value, type: String }
}

/**
 * Downloads an .xlsx workbook, one sheet per entry: a bold header row that
 * stays frozen at the top, numbers and dates as real Excel values so they
 * sort and sum, and sensible column widths.
 */
export async function exportWorkbook(fileName: string, sheets: ExportSheet<any>[]): Promise<void> {
  const built = sheets.map((sheet) => {
    const header: Row = sheet.columns.map((c) => ({
      value: c.header, fontWeight: 'bold', backgroundColor: '#ddeee1', color: '#1b3829',
    }))
    const body: Row[] = sheet.rows.map((row) => sheet.columns.map((c) => cell(c.value(row), c.format)))
    return {
      // Excel caps sheet names at 31 characters and forbids a few symbols.
      sheet: sheet.name.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31),
      data: [header, ...body],
      columns: sheet.columns.map((c) => ({ width: c.width ?? Math.max(12, Math.min(40, c.header.length + 4)) })),
      stickyRowsCount: 1,
    }
  })
  await writeXlsxFile(built).toFile(fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`)
}

/** Builds one sheet with its column functions typed from the rows. */
export function sheet<T>(definition: ExportSheet<T>): ExportSheet<T> {
  return definition
}
