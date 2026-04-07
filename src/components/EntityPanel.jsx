import { X } from './Icons'

const DISPLAY_LEVELS = ['division', 'district', 'upazila', 'union', 'mauza']

function hasRealName(level, h) {
  const entry = h?.[level]
  return entry?.name && entry.name !== entry.geocode
}

export default function EntityPanel({
  open, entity, selectedId, activeLevel,
  peerMeta, peerLoading, peerMode, areaStats, schema,
  onLevelSelect, onClose, onExitPeerMode, onToggle,
}) {
  const h      = entity?.hierarchy ?? {}
  const crumbs = DISPLAY_LEVELS.filter(l => hasRealName(l, h)).map(l => h[l].name)
  const tabs   = DISPLAY_LEVELS.filter(l => h[l])

  // Numeric fields that have stats
  const statFields = areaStats
    ? Object.entries(areaStats).filter(([, v]) => v && typeof v.sum === 'number')
    : []

  return (
    <div className={`panel ${open ? 'panel-open' : ''}`}>
      <div className="panel-drag" onClick={onToggle} role="button" tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && onToggle()}>
        <span className="drag-handle" />
      </div>

      <div className="panel-body">
        {/* Header */}
        <div className="panel-header">
          <div>
            <div className="entity-id">{entity?.id ?? selectedId ?? '—'}</div>
            {entity ? (
              <div className="entity-meta">
                <span className="coord">{entity.lat.toFixed(5)}°N, {entity.lng.toFixed(5)}°E</span>
                <code className="geocode">{entity.geocode}</code>
              </div>
            ) : selectedId ? (
              <div className="entity-meta loading-pulse">Fetching details…</div>
            ) : null}
          </div>
          <button className="btn-close" onClick={onClose} aria-label="Close"><X size={14} /></button>
        </div>

        {/* Hierarchy breadcrumb */}
        {crumbs.length > 0 && (
          <div className="breadcrumb">
            {crumbs.map((name, i) => (
              <span key={name}>
                <span className="crumb">{name}</span>
                {i < crumbs.length - 1 && <span className="crumb-sep">›</span>}
              </span>
            ))}
          </div>
        )}

        {/* Level selector */}
        {tabs.length > 0 && (
          <>
            <p className="section-label">Show peers at level</p>
            <div className="level-tabs">
              {tabs.map(level => {
                const name = hasRealName(level, h) ? h[level].name : ''
                return (
                  <button key={level}
                    className={`level-tab ${activeLevel === level ? 'active' : ''}`}
                    onClick={() => onLevelSelect(level)}>
                    <span className="tab-level">{capitalize(level)}</span>
                    {name && <span className="tab-area">{name}</span>}
                  </button>
                )
              })}
            </div>
          </>
        )}

        {/* Peer result */}
        {peerLoading && (
          <div className="peer-loading"><span className="mini-spinner" /> Loading peers…</div>
        )}

        {!peerLoading && peerMeta && (
          <div className="peer-result animate-fade-in">
            <span className="peer-count">{peerMeta.total.toLocaleString()}</span>
            <div className="peer-desc">
              <span className="peer-area">{peerMeta.areaName}</span>
              <span className="peer-level">{capitalize(peerMeta.level)}</span>
            </div>
          </div>
        )}

        {/* Area stats — numeric fields */}
        {statFields.length > 0 && (
          <div className="area-stats animate-fade-in">
            <p className="section-label" style={{marginTop: '14px'}}>Area Summary</p>
            <div className="stats-grid">
              {statFields.map(([field, s]) => (
                <div key={field} className="stat-card">
                  <div className="stat-label">{formatFieldLabel(field)}</div>
                  <div className="stat-value">{formatNumber(s.sum)}</div>
                  <div className="stat-sub">avg {formatNumber(s.avg)} · {s.count} entries</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Peer mode hint */}
        {peerMode && !peerLoading && (
          <div className="peer-hint animate-fade-in">
            <span className="hint-icon">👆</span>
            <span>Tap any highlighted location to view details</span>
            <button className="btn-exit-peer" onClick={onExitPeerMode}>Exit explore mode</button>
          </div>
        )}
      </div>
    </div>
  )
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1) }

function formatFieldLabel(key) {
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function formatNumber(n) {
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (Math.abs(n) >= 1_000)     return (n / 1_000).toFixed(1) + 'K'
  return n.toLocaleString()
}
