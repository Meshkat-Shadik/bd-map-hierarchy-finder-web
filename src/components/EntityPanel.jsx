import { useState } from 'react'
import { X, Info } from './Icons'

const DISPLAY_LEVELS = ['division', 'district', 'upazila', 'union', 'mauza']

function hasRealName(level, h) {
  const entry = h?.[level]
  return entry?.name && entry.name !== entry.geocode
}

// Explain geocode length → admin level
function geocodeLevelName(len) {
  if (len === 2)  return 'Division'
  if (len === 4)  return 'District'
  if (len === 6)  return 'City Corporation'
  if (len === 8)  return 'Upazila'
  if (len === 10) return 'Municipality'
  if (len === 13) return 'Union'
  if (len === 16) return 'Mauza'
  if (len === 20) return 'Village'
  if (len === 22) return 'Enumeration Area (EA)'
  return 'Location'
}

export default function EntityPanel({
  open, entity, selectedId, activeLevel,
  peerMeta, peerLoading, peerMode,
  onLevelSelect, onClose, onExitPeerMode, onToggle,
}) {
  const [geocodeOpen, setGeocodeOpen] = useState(false)

  const h      = entity?.hierarchy ?? {}
  const crumbs = DISPLAY_LEVELS.filter(l => hasRealName(l, h)).map(l => h[l].name)
  const tabs   = DISPLAY_LEVELS.filter(l => h[l])

  const gc     = entity?.geocode ?? ''
  const gcLevel = geocodeLevelName(gc.length)

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
            <div className="entity-id">{entity?.label ?? entity?.id ?? selectedId ?? '—'}</div>
            {entity ? (
              <div className="entity-meta">
                <span className="coord">{entity.lat.toFixed(5)}°N, {entity.lng.toFixed(5)}°E</span>
                <div className="geocode-row">
                  <code className="geocode">{entity.geocode}</code>
                  <button
                    className="btn-geocode-info"
                    onClick={() => setGeocodeOpen(v => !v)}
                    aria-label="What is this code?"
                  >
                    <Info size={12} />
                  </button>
                </div>
                {geocodeOpen && (
                  <div className="geocode-popover">
                    <strong>BD Administrative Geocode</strong>
                    <p>A {gc.length}-character code identifying this location at the <strong>{gcLevel}</strong> level in Bangladesh's administrative hierarchy.</p>
                    <p className="geocode-popover-levels">2=Division · 4=District · 8=Upazila · 13=Union · 16=Mauza · 22=EA</p>
                  </div>
                )}
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
