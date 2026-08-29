import { useState } from 'react'
import { useDb } from '../../state/useDb'
import { formatDate } from '../../domain/format'
import type { DocumentRecord } from '../../domain/types'
import {
  PageHeader, Section, Table, EmptyState, Badge, StatTile,
} from '../../components/ui'

const CATEGORIES: (DocumentRecord['category'] | 'All')[] =
  ['All', 'Drawing', 'BOQ', 'Contract', 'Photo', 'Report', 'Other']

export function Documents() {
  const db = useDb()
  const [filter, setFilter] = useState<DocumentRecord['category'] | 'All'>('All')

  const documents = [...db.documents]
    .filter((d) => filter === 'All' || d.category === filter)
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))

  const uploaderName = (id: string) => db.employees.find((e) => e.id === id)?.name ?? '—'
  const projectName = (id?: string) =>
    id ? db.projects.find((p) => p.id === id)?.name ?? '—' : '—'

  const size = (kb: number) => (kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`)

  return (
    <div>
      <PageHeader title="Documents" subtitle="Drawings, BOQs, contracts and site photography." />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Documents" value={db.documents.length} />
        <StatTile label="Drawings" value={db.documents.filter((d) => d.category === 'Drawing').length} />
        <StatTile label="Contracts" value={db.documents.filter((d) => d.category === 'Contract').length} />
        <StatTile
          label="Total Size"
          value={size(db.documents.reduce((s, d) => s + d.sizeKb, 0))}
        />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {CATEGORIES.map((category) => (
          <button
            key={category}
            onClick={() => setFilter(category)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              filter === category
                ? 'bg-brand-600 text-white'
                : 'border border-stone-300 bg-white text-stone-600 hover:bg-stone-50'
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      <Section>
        {documents.length === 0 ? (
          <EmptyState title="No documents in this category." />
        ) : (
          <Table head={['Name', 'Project', 'Category', 'Uploaded By', 'Date', 'Size']}>
            {documents.map((doc) => (
              <tr key={doc.id} className="row-hover">
                <td className="td font-medium text-stone-900">{doc.name}</td>
                <td className="td">{projectName(doc.projectId)}</td>
                <td className="td"><Badge tone="stone">{doc.category}</Badge></td>
                <td className="td">{uploaderName(doc.uploadedBy)}</td>
                <td className="td tabular-nums">{formatDate(doc.uploadedAt)}</td>
                <td className="td tabular-nums">{size(doc.sizeKb)}</td>
              </tr>
            ))}
          </Table>
        )}
      </Section>
    </div>
  )
}
