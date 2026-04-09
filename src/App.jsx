import { useState, useEffect, useCallback, useRef } from 'react'
import MapView           from './components/MapView'
import Navbar            from './components/Navbar'
import EntityPanel       from './components/EntityPanel'
import EntityDetailModal from './components/EntityDetailModal'
import UploadModal       from './components/UploadModal'
import WelcomeModal      from './components/WelcomeModal'
import DevInfoFooter     from './components/DevInfoFooter'
import LoadingScreen     from './components/LoadingScreen'
import { loadAllEntities, fetchEntityDetail, fetchPeers, fetchStatus, uploadCSV } from './api'
import { hasCSV, loadCSV, clearCSV } from './csvStore'

export default function App() {
  // ── Data ──────────────────────────────────────────────────────────────────
  const [entities,      setEntities]      = useState({})
  const [loading,       setLoading]       = useState(true)
  const [loadingMsg,    setLoadingMsg]    = useState('Connecting to server…')
  const [loadingPct,    setLoadingPct]    = useState(0)
  const [loadingSub,    setLoadingSub]    = useState('')
  const _crawlRef = useRef(null)   // interval for slow progress animation
  // Large dataset: dataset was truncated on server (>200K entities)
  const [isTruncated,   setIsTruncated]   = useState(false)
  const [nTotal,        setNTotal]        = useState(0)
  // BD boundary filter: track entities within Bangladesh vs outside
  const [skippedCount,  setSkippedCount]  = useState(0)

  // ── Selection (panel) ─────────────────────────────────────────────────────
  const [selectedId,   setSelectedId]   = useState(null)
  const [entityDetail, setEntityDetail] = useState(null)
  const [panelOpen,    setPanelOpen]    = useState(false)

  // ── Peer mode ─────────────────────────────────────────────────────────────
  const [peerIds,     setPeerIds]     = useState(null)
  const [peerMeta,    setPeerMeta]    = useState(null)
  const [peerLoading, setPeerLoading] = useState(false)
  const [activeLevel, setActiveLevel] = useState(null)

  // ── Detail modal (tap a peer) ─────────────────────────────────────────────
  const [detailModal,  setDetailModal]  = useState(null)
  const [modalLoading, setModalLoading] = useState(false)
  const detailCacheRef = useRef({})

  // ── Upload modal ──────────────────────────────────────────────────────────
  const [uploadOpen, setUploadOpen] = useState(false)

  // ── Welcome modal ──────────────────────────────────────────────────────────
  const [welcomed, setWelcomed] = useState(() => {
    return localStorage.getItem('bdlf_welcomed') === 'true'
  })

  // ── Theme ──────────────────────────────────────────────────────────────────
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('bdlf_theme') || 'dark'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('bdlf_theme', theme)
  }, [theme])

  // ── Boot ──────────────────────────────────────────────────────────────────
  useEffect(() => { boot() }, [])

  const _pctRef = useRef(0)   // mirrors loadingPct for use inside intervals

  // Slowly creep the progress bar toward `target` over `ms` so it never looks stuck
  function crawlTo(target, ms = 6000) {
    clearInterval(_crawlRef.current)
    let current = _pctRef.current
    const steps   = 30
    const delay   = Math.max(50, ms / steps)
    const perStep = (target - current) / steps
    _crawlRef.current = setInterval(() => {
      current += perStep
      if (current >= target) { current = target; clearInterval(_crawlRef.current) }
      const rounded = Math.round(current)
      _pctRef.current = rounded
      setLoadingPct(rounded)
    }, delay)
  }

  function snapTo(pct) {
    clearInterval(_crawlRef.current)
    _pctRef.current = pct
    setLoadingPct(pct)
  }

  // Shared helper: download all entities from server and apply to state.
  // nSkipped comes from /status (n_skipped) — entities are pre-filtered during
  // ingest so every entity in the index has a valid Bangladesh geocode.
  async function _loadFromServer(n, nSkipped = 0) {
    setLoadingMsg(`Downloading ${n > 0 ? n.toLocaleString() + ' entities' : 'data'}…`)
    setLoadingSub(n > 0 ? 'Transferring from server…' : '')
    crawlTo(88, Math.max(4000, n / 30))

    const { entities: ents, truncated, nTotal } = await loadAllEntities()
    snapTo(92)
    setLoadingMsg('Rendering map…')
    setLoadingSub('')
    setEntities(ents)
    setSkippedCount(nSkipped)
    setIsTruncated(truncated)
    setNTotal(nTotal)
    snapTo(100)
    await _sleep(180)
  }

  async function boot() {
    // ── Step A: ping /status with retry (handles HuggingFace cold-start) ──────
    setLoadingMsg('Connecting to server…')
    setLoadingSub('')
    crawlTo(20, 4000)

    let status = null
    for (let attempt = 0; attempt < 30 && !status; attempt++) {
      try { status = await fetchStatus() } catch { /* server cold-starting */ }
      if (!status) {
        setLoadingMsg('Server is starting up…')
        setLoadingSub('HuggingFace Spaces wakes from sleep — takes a few seconds')
        await _sleep(2500)
      }
    }

    if (!status) {
      setLoadingMsg('Could not reach the server. Please refresh.')
      return
    }

    snapTo(25)
    setLoadingSub('')

    // ── Step B: wait out any ongoing build ────────────────────────────────────
    if (status.build_running) {
      setLoadingMsg('Building your data index…')
      crawlTo(50, 30000)
      while (status.build_running) {
        await _sleep(2500)
        try { status = await fetchStatus() } catch { /* keep polling */ }
        const n = status?.n_entities
        if (n > 0) setLoadingSub(`${n.toLocaleString()} entities indexed so far…`)
      }
    }

    snapTo(50)

    // ── Branch 1: server already has data → load it ───────────────────────────
    if (status.is_loaded) {
      try {
        await _loadFromServer(status.n_entities ?? 0, status.n_skipped ?? 0)
      } catch (err) {
        clearInterval(_crawlRef.current)
        if (err.status !== 503) {
          console.error(err)
          setLoadingMsg('Failed to load. Check console.')
          setLoadingSub('')
          return
        }
      }
      setLoading(false)
      return
    }

    // ── Branch 2: server has no data ──────────────────────────────────────────
    const csvExists = await hasCSV()
    if (!csvExists) {
      // No data anywhere — show empty state / upload prompt
      setLoading(false)
      return
    }

    // ── Sub-branch 2a: auto-reupload from IndexedDB ───────────────────────────
    const stored = await loadCSV()
    if (!stored) {
      setLoading(false)
      return
    }

    setLoadingMsg('Session expired — re-uploading your CSV…')
    setLoadingSub('Your file was saved locally and is being restored automatically')
    crawlTo(60, 10000)

    try {
      await uploadCSV(stored.file, stored.extraFields, stored.displayField)
    } catch (err) {
      // Clear stale CSV to prevent infinite retry loop on every page load
      await clearCSV()
      setLoadingMsg('Auto-reupload failed. Please upload your CSV manually.')
      setLoading(false)
      return
    }

    // Poll until build finishes, max 5 min
    status = null
    for (let attempt = 0; attempt < 120; attempt++) {
      await _sleep(2500)
      try { status = await fetchStatus() } catch { /* keep polling */ }
      if (status?.is_loaded) break
      if (status?.build_running) {
        const n = status.n_entities
        if (n > 0) setLoadingSub(`${n.toLocaleString()} entities indexed so far…`)
      }
    }
    if (!status?.is_loaded) {
      setLoadingMsg('Build timed out. Please refresh and try again.')
      setLoading(false)
      return
    }

    snapTo(70)
    try {
      await _loadFromServer(status.n_entities ?? 0, status.n_skipped ?? 0)
    } catch (err) {
      clearInterval(_crawlRef.current)
      console.error(err)
    }
    setLoading(false)
  }

  function _sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

  // ── Marker click ──────────────────────────────────────────────────────────
  const onMarkerClick = useCallback(async (id) => {
    if (peerIds !== null) return
    setSelectedId(id)
    setActiveLevel(null)
    setPeerIds(null)
    setPeerMeta(null)
    setPanelOpen(true)
    setEntityDetail(null)

    if (detailCacheRef.current[id]) {
      setEntityDetail(detailCacheRef.current[id])
      return
    }
    try {
      const detail = await fetchEntityDetail(id)
      setEntityDetail(detail)
      detailCacheRef.current[id] = detail
    } catch (err) {
      console.error(err)
    }
  }, [peerIds])

  // ── Peer marker click ──────────────────────────────────────────────────────
  const onPeerMarkerClick = useCallback(async (id, isDimmed = false) => {
    if (detailCacheRef.current[id]) {
      setDetailModal({ ...detailCacheRef.current[id], isDimmed })
      return
    }
    setModalLoading(true)
    setDetailModal({ id, _loading: true, isDimmed })
    try {
      const detail = await fetchEntityDetail(id)
      detailCacheRef.current[id] = detail
      setDetailModal({ ...detail, isDimmed })
    } catch (err) {
      setDetailModal({ id, error: err.message, isDimmed })
    } finally {
      setModalLoading(false)
    }
  }, [])

  // ── Level select ──────────────────────────────────────────────────────────
  const onLevelSelect = useCallback(async (level) => {
    if (!selectedId || !entityDetail) return
    setActiveLevel(level)
    setPeerLoading(true)
    setPeerIds(null)

    try {
      const data = await fetchPeers(selectedId, level)
      const ids  = new Set((data.peers ?? []).map(p => p.id))
      setPeerIds(ids)
      setPeerMeta({
        total:    data.total,
        areaName: data.area_name ?? level,
        level,
        geocode:  data.area_geocode,
      })
    } catch (err) {
      console.error(err)
    } finally {
      setPeerLoading(false)
    }
  }, [selectedId, entityDetail])

  // ── Exit peer mode ────────────────────────────────────────────────────────
  const onExitPeerMode = useCallback(() => {
    setPeerIds(null); setPeerMeta(null); setActiveLevel(null)
  }, [])

  // ── Full reset ────────────────────────────────────────────────────────────
  const onClose = useCallback(() => {
    setSelectedId(null); setEntityDetail(null); setPanelOpen(false)
    setPeerIds(null); setPeerMeta(null); setActiveLevel(null)
  }, [])

  // ── Upload success ────────────────────────────────────────────────────────
  const onUploaded = useCallback(() => {
    setUploadOpen(false)
    onClose()
    detailCacheRef.current = {}

    ;(async () => {
      setLoading(true)
      snapTo(10)
      setLoadingMsg('CSV uploaded — building index…')
      setLoadingSub('This can take 30 s to a few minutes depending on file size')
      crawlTo(60, 60000)

      // Poll until loaded, max 5 min (120 × 2.5 s)
      let status = null
      for (let attempt = 0; attempt < 120; attempt++) {
        await _sleep(2500)
        try { status = await fetchStatus() } catch { /* keep polling */ }
        if (status?.is_loaded) break
        if (status?.build_running) {
          const n = status.n_entities
          if (n > 0) setLoadingSub(`${n.toLocaleString()} entities indexed so far…`)
        }
      }

      if (!status?.is_loaded) {
        setLoadingMsg('Build timed out. Please refresh and try again.')
        setLoadingSub('')
        setLoading(false)
        return
      }

      snapTo(70)
      try {
        await _loadFromServer(status.n_entities ?? 0, status.n_skipped ?? 0)
      } catch (err) {
        clearInterval(_crawlRef.current)
        setLoadingMsg('Failed to load data. Please refresh.')
        setLoadingSub(err.message)
        console.error(err)
      }
      setLoading(false)
    })()
  }, [onClose])

  const peerMode = peerIds !== null

  return (
    <>
      <Navbar
        entityCount={Object.keys(entities).length}
        nTotal={nTotal}
        peerMeta={peerMeta}
        peerMode={peerMode}
        theme={theme}
        onThemeChange={setTheme}
        onReset={onClose}
        onExitPeerMode={onExitPeerMode}
        onUploadClick={() => setUploadOpen(true)}
      />

      {(isTruncated || skippedCount > 0) && !loading && (
        <div className="banners-container">
          {isTruncated && (
            <div className="truncation-banner">
              Showing first 200,000 of {nTotal.toLocaleString()} locations — dataset too large to render all at once.
              Use the level tabs to explore areas.
            </div>
          )}

          {skippedCount > 0 && (
            <div className="skipped-banner">
              {skippedCount.toLocaleString()} locations outside Bangladesh were skipped.
            </div>
          )}
        </div>
      )}

      <MapView
        entities={entities}
        selectedId={selectedId}
        peerIds={peerIds}
        peerMode={peerMode}
        onMarkerClick={onMarkerClick}
        onPeerMarkerClick={onPeerMarkerClick}
        onMapClick={peerMode ? null : onClose}
      />

      <EntityPanel
        open={panelOpen}
        entity={entityDetail}
        selectedId={selectedId}
        activeLevel={activeLevel}
        peerMeta={peerMeta}
        peerLoading={peerLoading}
        peerMode={peerMode}
        onLevelSelect={onLevelSelect}
        onClose={onClose}
        onExitPeerMode={onExitPeerMode}
        onToggle={() => setPanelOpen(v => !v)}
      />

      <EntityDetailModal
        entity={detailModal}
        loading={modalLoading}
        onClose={() => setDetailModal(null)}
      />

      <UploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onSuccess={onUploaded}
      />

      {!welcomed && <WelcomeModal onAccept={() => setWelcomed(true)} />}

      {loading && <LoadingScreen message={loadingMsg} sub={loadingSub} pct={loadingPct} />}

      <DevInfoFooter />
    </>
  )
}
