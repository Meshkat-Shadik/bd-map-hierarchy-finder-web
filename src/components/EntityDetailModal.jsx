import { useState } from 'react'
import { X, Info } from './Icons'

// ── Field type detection ──────────────────────────────────────────────────────
function detectType(key) {
  const k = key.toLowerCase()
  if (/salary|revenue|income|amount|price|cost|fee|budget|payment|earning/.test(k)) return 'money'
  if (/stock|count|quantity|unit|inventory/.test(k))   return 'quantity'
  if (/phone|mobile|contact|tel/.test(k))              return 'phone'
  if (/name|manager|owner/.test(k))                    return 'person'
  return 'text'
}

function formatValue(type, value) {
  if (!value && value !== 0) return '—'
  if (type === 'money') {
    const n = parseFloat(value)
    if (!isNaN(n)) {
      if (Math.abs(n) >= 1_000_000) return `৳ ${(n / 1_000_000).toFixed(2)}M`
      if (Math.abs(n) >= 1_000)     return `৳ ${(n / 1_000).toFixed(1)}K`
      return `৳ ${Number(n).toLocaleString()}`
    }
  }
  if (type === 'quantity') {
    const n = parseFloat(value)
    if (!isNaN(n)) return Number(n).toLocaleString()
  }
  return String(value)
}

// ── Auto-group fields by numbered prefix: employee1_name → "Employee 1" ─────
function groupMetadata(metadata) {
  const fields  = Object.keys(metadata)
  const groups  = {}            // groupKey → { label, entries }
  const grouped = new Set()

  // Numbered-prefix groups: employee1_salary, employee2_name, etc.
  const prefixRe = /^([a-z]+)(\d+)[_\s](.+)$/i
  for (const key of fields) {
    const m = key.match(prefixRe)
    if (m) {
      const gk    = (m[1] + m[2]).toLowerCase()   // e.g. "employee1"
      const label = capitalize(m[1]) + ' ' + m[2] // "Employee 1"
      if (!groups[gk]) groups[gk] = { label, entries: [], numbered: true }
      const subLabel = m[3].replace(/_/g, ' ')
      const type     = detectType(key)
      groups[gk].entries.push({ key, label: capitalize(subLabel), value: metadata[key], type })
      grouped.add(key)
    }
  }

  // Remaining fields → categorize by keyword
  const cats = { money: [], person: [], quantity: [], phone: [], text: [] }
  for (const key of fields) {
    if (grouped.has(key)) continue
    const type = detectType(key)
    cats[type].push({ key, label: formatFieldLabel(key), value: metadata[key], type })
  }

  const catLabels = { money: 'Financials', person: 'Personnel', quantity: 'Inventory', phone: 'Contacts', text: 'Details' }
  for (const [cat, entries] of Object.entries(cats)) {
    if (entries.length === 0) continue
    const gk = '_cat_' + cat
    groups[gk] = { label: catLabels[cat], entries, numbered: false }
  }

  return Object.values(groups)
}

// ── Hierarchy breadcrumb helper ───────────────────────────────────────────────
const DISPLAY_LEVELS = ['division', 'district', 'upazila', 'union', 'mauza']

function getCrumbs(hierarchy) {
  return DISPLAY_LEVELS
    .filter(l => hierarchy?.[l]?.name && hierarchy[l].name !== hierarchy[l].geocode)
    .map(l => hierarchy[l].name)
}

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

// ── Component ────────────────────────────────────────────────────────────────
export default function EntityDetailModal({ entity, loading, onClose }) {
  const [geocodeOpen, setGeocodeOpen] = useState(false)

  if (!entity) return null

  const isLoading = entity._loading || loading
  const metadata  = entity.metadata ?? {}
  const hasFields = Object.keys(metadata).length > 0
  const groups    = hasFields ? groupMetadata(metadata) : []
  const crumbs    = getCrumbs(entity.hierarchy)

  const gc      = entity.geocode ?? ''
  const gcLevel = geocodeLevelName(gc.length)

  return (
    <div className="detail-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="detail-modal animate-fade-in">

        {/* ── Header ── */}
        <div className="detail-header">
          <div className="detail-id-block">
            <div className="detail-entity-id">{entity.label ?? entity.id}</div>
            {!isLoading && entity.lat && (
              <div className="detail-coords">
                {entity.lat.toFixed(5)}°N, {entity.lng.toFixed(5)}°E
                {gc && (
                  <div className="geocode-row">
                    <code className="geocode detail-geocode">{gc}</code>
                    <button
                      className="btn-geocode-info"
                      onClick={() => setGeocodeOpen(v => !v)}
                      aria-label="What is this code?"
                    >
                      <Info size={11} />
                    </button>
                  </div>
                )}
                {geocodeOpen && (
                  <div className="geocode-popover">
                    <strong>BD Administrative Geocode</strong>
                    <p>A {gc.length}-character code identifying this location at the <strong>{gcLevel}</strong> level in Bangladesh's administrative hierarchy.</p>
                    <p className="geocode-popover-levels">2=Division · 4=District · 8=Upazila · 13=Union · 16=Mauza · 22=EA</p>
                  </div>
                )}
              </div>
            )}
          </div>
          <button className="btn-close detail-close" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {/* ── Status Banner (Outside scope / Error) ── */}
        {!isLoading && entity.isDimmed && (
          <div className="detail-banner detail-banner-warning">
            Note: This location is outside the currently explored area.
          </div>
        )}
        {!isLoading && entity.error && (
          <div className="detail-banner detail-banner-error">
            Failed to retrieve details: {entity.error}
          </div>
        )}

        {/* ── Breadcrumb ── */}
        {crumbs.length > 0 && (
          <div className="detail-crumb">
            {crumbs.map((name, i) => (
              <span key={name}>
                <span className="detail-crumb-item">{name}</span>
                {i < crumbs.length - 1 && <span className="crumb-sep">›</span>}
              </span>
            ))}
          </div>
        )}

        {/* ── Loading state ── */}
        {isLoading && (
          <div className="detail-loading">
            <div className="spinner" />
            <span>Loading details…</span>
          </div>
        )}

        {/* ── Field groups ── */}
        {!isLoading && groups.length > 0 && (
          <div className="detail-body">
            {groups.map(group => (
              <div key={group.label} className="field-group">
                <div className="field-group-label">{group.label}</div>
                <div className={`field-grid ${group.numbered ? 'field-grid-2' : 'field-grid-auto'}`}>
                  {group.entries.map(entry => (
                    <FieldCard key={entry.key} entry={entry} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── No metadata ── */}
        {!isLoading && !entity.error && groups.length === 0 && (
          <div className="detail-empty animate-fade-in">
            <div className="empty-state-icon">📄</div>
            <h3>No information found</h3>
            <p>This location has no extra fields associated with it.</p>
            <p className="detail-empty-hint">To view more data, upload a CSV containing additional columns.</p>
          </div>
        )}

      </div>
    </div>
  )
}

function FieldCard({ entry }) {
  const { label, value, type } = entry
  const formatted = formatValue(type, value)

  const typeClass = {
    money:    'field-money',
    person:   'field-person',
    phone:    'field-phone',
    quantity: 'field-quantity',
    text:     '',
  }[type] ?? ''

  return (
    <div className={`field-card ${typeClass}`}>
      <div className="field-card-label">{label}</div>
      {type === 'phone' && value ? (
        <a href={`tel:${value}`} className="field-card-value field-phone-link">{value}</a>
      ) : (
        <div className={`field-card-value ${typeClass}`}>{formatted}</div>
      )}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1) }
function formatFieldLabel(key) {
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}
