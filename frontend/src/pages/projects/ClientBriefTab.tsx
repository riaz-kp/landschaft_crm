import { useState } from 'react'
import { api } from '../../api/client'
import { useDb } from '../../state/useDb'
import { briefFor, briefProgress } from '../../domain/clientBrief'
import type { Project } from '../../domain/types'
import { Badge, EmptyState, ProgressBar, Section } from '../../components/ui'
import { Icon } from '../../components/Icon'
import { BriefAnswersView } from '../../components/BriefAnswersView'
import { ShareLinkModal, newShareToken, portalUrl } from '../../components/ShareLink'

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })

/**
 * The project's Client Checklist tab: the link the client fills the Landscape
 * Requirement Checklist through, and their answers once they send it.
 */
export function ClientBriefTab({ project, canManage }: { project: Project; canManage: boolean }) {
  const db = useDb()
  const [sharing, setSharing] = useState(false)
  const brief = briefFor(db.clientBriefs, project.id)
  const client = db.clients.find((c) => c.id === project.clientId)
  const progress = brief && briefProgress(brief.answers)

  const share = (
    <button onClick={() => setSharing(true)} className={brief || !canManage ? 'btn-secondary py-1.5' : 'btn-primary py-1.5'}>
      <Icon name="send" className="h-4 w-4" /> {project.briefToken ? 'Client link' : 'Send to client'}
    </button>
  )

  return (
    <>
      <Section
        title="Landscape Requirement Checklist"
        description="Filled in by the client through their link — family, how they will use the garden, spaces, style, water, budget."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {brief ? <Badge tone="green">Received</Badge> : project.briefToken ? <Badge tone="amber">Waiting for client</Badge> : <Badge tone="stone">Not sent</Badge>}
            {share}
          </div>
        }
      >
        {brief && progress ? (
          <>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-stone-100 bg-stone-50/60 px-5 py-3 text-sm text-stone-600">
              <span>Sent {when(brief.submittedAt)}</span>
              {brief.updatedAt !== brief.submittedAt && <span>Last changed {when(brief.updatedAt)}</span>}
              <span className="flex min-w-[180px] flex-1 items-center gap-2">
                <span className="flex-1"><ProgressBar value={(progress.answered / progress.asked) * 100} size="sm" /></span>
                <span className="text-xs font-semibold tabular-nums">{progress.answered} / {progress.asked} answered</span>
              </span>
            </div>
            <BriefAnswersView answers={brief.answers} />
          </>
        ) : project.briefToken ? (
          <EmptyState
            icon="clock"
            title="The link is out — the client has not sent the checklist yet."
            hint="Their answers appear here the moment they send them. Use Client link to send it again."
          />
        ) : (
          <EmptyState
            icon="list"
            title="The client has not been sent the checklist yet."
            hint={canManage ? 'Send to client makes a link they open on their phone — no login — and fill in themselves.' : undefined}
          />
        )}
      </Section>

      {sharing && (
        <ShareLinkModal
          title="Requirement checklist link"
          intro={<>
            The client opens this link — no login — and fills in the Landscape Requirement Checklist for <strong>{project.name}</strong>.
            Their answers show on this tab, and they can come back and change them until the link is turned off.
          </>}
          url={project.briefToken && portalUrl('checklist', project.briefToken)}
          phone={client?.whatsapp || client?.phone}
          message={`Hello${client ? ` ${client.name}` : ''}, to start the design of your garden, please fill in this short checklist from Landschaft:`}
          canManage={canManage}
          onCreate={() => api.projects.update(project.id, { briefToken: newShareToken() })}
          onDisable={() => api.projects.update(project.id, { briefToken: undefined })}
          onClose={() => setSharing(false)}
        />
      )}
    </>
  )
}
