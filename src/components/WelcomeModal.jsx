import { useState } from 'react'
import { X } from './Icons'

export default function WelcomeModal({ onAccept }) {
  const [agreed, setAgreed] = useState(false)

  const handleAccept = () => {
    if (agreed) {
      localStorage.setItem('bdlf_welcomed', 'true')
      onAccept()
    }
  }

  return (
    <div className="welcome-backdrop">
      <div className="welcome-modal animate-fade-in">
        {/* ── Header ── */}
        <div className="welcome-header">
          <h1 className="welcome-title">Bangladesh Location Finder</h1>
          <p className="welcome-subtitle">Explore administrative divisions and upload custom location data</p>
        </div>

        {/* ── Body ── */}
        <div className="welcome-body">
          <section className="welcome-section">
            <h2>Data Privacy & Usage</h2>
            <p>
              This application processes geographic coordinates and metadata. When you upload a CSV:
            </p>
            <ul className="welcome-list">
              <li><strong>Small files (&lt;50K rows):</strong> Processed locally in your browser. Your data stays on your device and is stored in browser storage.</li>
              <li><strong>Large files (&gt;50K rows):</strong> Uploaded to our server for processing. Data is isolated per session and deleted after 24 hours of inactivity.</li>
              <li><strong>No tracking:</strong> We do not store, sell, or share your data with third parties.</li>
            </ul>
          </section>

          <section className="welcome-section">
            <h2>Dataset Attribution</h2>
            <p>
              This tool uses Bangladesh administrative and geographic data. When working with location data:
            </p>
            <ul className="welcome-list">
              <li>Ensure you have proper licensing rights for any data you upload.</li>
              <li>Respect copyright, data protection laws, and DMCA regulations applicable in your jurisdiction.</li>
              <li>This tool is provided "as-is" for educational and authorized use only.</li>
            </ul>
          </section>

          <section className="welcome-section">
            <h2>How to Use</h2>
            <p>
              Upload a CSV file with <code className="inline-code">lat</code>, <code className="inline-code">lng</code> (or <code className="inline-code">lon</code>), and optional metadata columns.
              The app will geocode your locations and display them on an interactive map.
              Filter by administrative level (Division → District → Upazila → Union → Mauza).
            </p>
          </section>

          <section className="welcome-section">
            <h2>Attribution</h2>
            <p>
              Built by: <strong>Meshkat Shadik</strong><br/>
              Data sources: Bangladesh Geospatial Data<br/>
              <a href="#" className="welcome-link">Documentation</a> •
              <a href="#" className="welcome-link">GitHub</a>
            </p>
          </section>
        </div>

        {/* ── Footer ── */}
        <div className="welcome-footer">
          <label className="welcome-checkbox">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
            />
            <span>I understand and accept the data usage terms</span>
          </label>
          <button
            className={`btn btn-primary ${!agreed ? 'btn-disabled' : ''}`}
            onClick={handleAccept}
            disabled={!agreed}
          >
            Get Started
          </button>
        </div>
      </div>
    </div>
  )
}
