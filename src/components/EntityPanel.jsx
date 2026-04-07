import { X } from './Icons'

// Only show levels that have a real name (not a raw geocode string)
const DISPLAY_LEVELS = ['division', 'district', 'upazila', 'union', 'mauza']

function hasRealName(level, h) {
  const entry = h?.[level]
  return entry?.name && entry.name !== entry.geocode
}

export default function EntityPanel({
  open, entity, selectedId, activeLevel,
  peerMeta, peerLoading,
  onLevelSelect, onClose, onToggle,
}) {
  const h = entity?.hierarchy ?? {}

  const crumbs = DISPLAY_LEVELS
    .filter(l => hasRealName(l, h))
    .map(l => h[l].name)

  const tabs = DISPLAY_LEVELS.filter(l => h[l])

  return (
    <div className={`panel ${open ? 'panel-open' : ''}`}>
      {/* Drag bar */}
      <div className="panel-drag" onClick={onToggle} role="button" tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && onToggle()}>
        <span className="drag-handle" />
      </div>

      <div className="panel-body">
        {/* Header */}
        <div className="panel-header">
          <div>
            <div className="entity-id">
              {entity?.id ?? selectedId ?? '—'}
            </div>
            {entity ? (
              <div className="entity-meta">
                <span className="coord">
                  {entity.lat.toFixed(5)}°N, {entity.lng.toFixed(5)}°E
                </span>
                <code className="geocode">{entity.geocode}</code>
              </div>
            ) : selectedId ? (
              <div className="entity-meta loading-pulse">Fetching details…</div>
            ) : null}
          </div>
          <button className="btn-close" onClick={onClose} aria-label="Close">
            <X size={14} />
          </button>
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
                  <button
                    key={level}
                    className={`level-tab ${activeLevel === level ? 'active' : ''}`}
                    onClick={() => onLevelSelect(level)}
                  >
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
          <div className="peer-loading">
            <span className="mini-spinner" /> Loading peers…
          </div>
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
      </div>
    </div>
  )
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
