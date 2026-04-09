export default function LoadingScreen({ message, sub, pct = 0 }) {
  return (
    <div className="loading-screen">
      <div className="loading-inner">

        <div className="loading-brand">
          <span className="brand-dot" />
          BD Location Finder
        </div>

        <div className="loading-bar-track">
          <div
            className="loading-bar-fill"
            style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
          />
        </div>

        <div className="loading-pct">{pct}%</div>

        <p className="loading-text">{message}</p>

        {sub && <p className="loading-sub">{sub}</p>}

      </div>
    </div>
  )
}
