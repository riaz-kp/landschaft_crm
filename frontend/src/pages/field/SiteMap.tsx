import type { Project } from '../../domain/types'
import { MapPicker, mapsUrl } from '../../components/MapPicker'
import { directionsUrl, placeSearchUrl } from '../../components/mapLinks'
import { SiteName } from '../../components/ui'
import { Icon } from '../../components/Icon'

/**
 * Where a site is, for the foreman on the way there: the address, the pin the
 * office dropped, and a button that opens directions on the phone.
 */
export function SiteMap({ project, height = 220 }: { project: Project; height?: number }) {
  const at = project.siteCoords
  return (
    <div className="space-y-3">
      <p className="flex items-start gap-2 text-sm text-stone-700">
        <Icon name="pin" className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
        <span className="min-w-0 font-medium"><SiteName name={project.siteLocation} /></span>
      </p>
      {at ? (
        <MapPicker value={at} height={height} />
      ) : (
        <p className="rounded-xl bg-stone-50 px-3 py-4 text-center text-sm text-stone-500">
          The office has not pinned this site on the map yet — directions use the site name instead.
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <a href={directionsUrl(at ?? project.siteLocation)} target="_blank" rel="noreferrer" className="btn-primary py-2.5">
          <Icon name="map" className="h-4 w-4" /> Directions
        </a>
        <a href={at ? mapsUrl(at) : placeSearchUrl(project.siteLocation)} target="_blank" rel="noreferrer" className="btn-secondary py-2.5">
          <Icon name="pin" className="h-4 w-4" /> Open in Maps
        </a>
      </div>
    </div>
  )
}
