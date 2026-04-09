import { useState } from 'react'
import { X } from './Icons'

export default function DevInfoFooter() {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className={`dev-footer ${expanded ? 'expanded' : 'collapsed'}`}>
      {!expanded ? (
        <button className="dev-footer-toggle" onClick={() => setExpanded(true)} title="Show developer information">
          © Developer Info
        </button>
      ) : (
        <div className="dev-footer-content animate-fade-in">
          <button className="dev-footer-close" onClick={() => setExpanded(false)} aria-label="Close">
            <X size={14} />
          </button>

          <div className="dev-section">
            <h4>About</h4>
            <p>
              <strong>Bangladesh Location Finder</strong> is an interactive tool for exploring administrative divisions and analyzing geographic location data within Bangladesh.
            </p>
          </div>

          <div className="dev-section">
            <h4>Developer</h4>
            <p>
              Built by <strong>Meshkat Shadik</strong>
            </p>
          </div>

          <div className="dev-section">
            <h4>Data Sources</h4>
            <ul>
              <li>Bangladesh administrative boundaries and geocodes</li>
              <li>OpenStreetMap via CartoDB for basemap</li>
              <li>Leaflet for map rendering</li>
            </ul>
          </div>

          <div className="dev-section">
            <h4>Technology</h4>
            <p>
              Frontend: React · Backend: Python (FastAPI)<br/>
              Hosted on Hugging Face Spaces
            </p>
          </div>

          <div className="dev-section">
            <h4>Resources</h4>
            <p>
              <a href="https://github.com" className="dev-link" target="_blank" rel="noopener noreferrer">GitHub Repository</a>
              {' • '}
              <a href="#" className="dev-link">Documentation</a>
              {' • '}
              <a href="#" className="dev-link">Report an Issue</a>
            </p>
          </div>

          <div className="dev-section dev-footer-meta">
            <p className="dev-footer-version">Version 6.0 • Last updated 2024</p>
          </div>
        </div>
      )}
    </div>
  )
}
