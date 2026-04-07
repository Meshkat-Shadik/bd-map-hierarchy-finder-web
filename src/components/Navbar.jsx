import { RotateCcw, Upload } from './Icons'

export default function Navbar({ entityCount, peerMeta, onReset, onUploadClick }) {
  return (
    <nav className="navbar">
      <div className="nav-brand">
        <span className="brand-dot" />
        BD Location Finder
      </div>

      <div className="nav-chips">
        <div className="chip chip-teal">
          <span className="chip-dot teal" />
          {entityCount > 0 ? entityCount.toLocaleString() : '—'} entities
        </div>

        {peerMeta && (
          <div className="chip chip-red animate-fade-in">
            <span className="chip-dot red" />
            {peerMeta.total.toLocaleString()} peers · {peerMeta.areaName}
          </div>
        )}
      </div>

      <div className="nav-actions">
        <button className="btn-icon" onClick={onReset} title="Reset view">
          <RotateCcw size={15} />
        </button>
        <button className="btn-primary" onClick={onUploadClick}>
          <Upload size={14} />
          Upload CSV
        </button>
      </div>
    </nav>
  )
}
