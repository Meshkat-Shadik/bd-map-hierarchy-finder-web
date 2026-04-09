import { RotateCcw, Upload, Moon, Sun } from './Icons'

export default function Navbar({ entityCount, peerMeta, peerMode, theme, onThemeChange, onReset, onExitPeerMode, onUploadClick }) {
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
        <button className="btn-icon" onClick={() => onThemeChange(theme === 'dark' ? 'light' : 'dark')} title="Toggle theme">
          {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
        </button>
        {peerMode ? (
          <button className="btn-exit" onClick={onExitPeerMode} title="Exit explore mode">
            ✕ Exit explore
          </button>
        ) : (
          <button className="btn-icon" onClick={onReset} title="Reset view">
            <RotateCcw size={15} />
          </button>
        )}
        <button className="btn-primary" onClick={onUploadClick}>
          <Upload size={14} />
          Upload CSV
        </button>
      </div>
    </nav>
  )
}
