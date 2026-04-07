import { useState, useEffect, useCallback, useRef } from 'react'
import MapView        from './components/MapView'
import Navbar         from './components/Navbar'
import EntityPanel    from './components/EntityPanel'
import EntityDetailModal from './components/EntityDetailModal'
import UploadModal    from './components/UploadModal'
import LoadingScreen  from './components/LoadingScreen'
import { loadAllEntities, fetchEntityDetail, fetchPeers, fetchSchema, fetchAreaStats } from './api'

export default function App() {
  // ── Data ──────────────────────────────────────────────────────────────────
  const [entities,    setEntities]    = useState({})
  const [schema,      setSchema]      = useState([])      // extra field names
  const [loading,     setLoading]     = useState(true)
  const [loadingMsg,  setLoadingMsg]  = useState('Loading entities…')

  // ── Selection (panel) ─────────────────────────────────────────────────────
  const [selectedId,    setSelectedId]    = useState(null)
  const [entityDetail,  setEntityDetail]  = useState(null)
  const [panelOpen,     setPanelOpen]     = useState(false)

  // ── Peer mode ─────────────────────────────────────────────────────────────
  const [peerIds,     setPeerIds]     = useState(null)  // Set<id> | null
  const [peerMeta,    setPeerMeta]    = useState(null)  // {total, areaName, level, geocode}
  const [peerLoading, setPeerLoading] = useState(false)
  const [activeLevel, setActiveLevel] = useState(null)
  const [areaStats,   setAreaStats]   = useState(null)  // numeric stats for area

  // ── Detail modal (tap a peer) ─────────────────────────────────────────────
  const [detailModal,  setDetailModal]  = useState(null)   // full entity detail
  const [modalLoading, setModalLoading] = useState(false)
  const detailCacheRef = useRef({})   // id → full entity (avoid re-fetch)

  // ── Upload modal ──────────────────────────────────────────────────────────
  const [uploadOpen, setUploadOpen] = useState(false)

  // ── Boot ──────────────────────────────────────────────────────────────────
  useEffect(() => { boot() }, [])

  async function boot() {
    try {
      const [data, sch] = await Promise.all([loadAllEntities(), fetchSchema()])
      setEntities(data)
      setSchema(sch.fields ?? [])
    } catch (err) {
      console.error(err)
      setLoadingMsg('Failed to load. Check console.')
      return
    }
    setLoading(false)
  }

  // ── Marker click (not in peer mode) ───────────────────────────────────────
  const onMarkerClick = useCallback(async (id) => {
    if (peerIds !== null) return   // locked — only peer clicks allowed
    setSelectedId(id)
    setActiveLevel(null)
    setPeerIds(null)
    setPeerMeta(null)
    setAreaStats(null)
    setPanelOpen(true)
    setEntityDetail(null)
    try {
      const detail = await fetchEntityDetail(id)
      setEntityDetail(detail)
      detailCacheRef.current[id] = detail
    } catch (err) {
      console.error(err)
    }
  }, [peerIds])

  // ── Peer marker click (opens detail modal) ────────────────────────────────
  const onPeerMarkerClick = useCallback(async (id) => {
    if (detailCacheRef.current[id]) {
      setDetailModal(detailCacheRef.current[id])
      return
    }
    setModalLoading(true)
    setDetailModal({ id, _loading: true })
    try {
      const detail = await fetchEntityDetail(id)
      detailCacheRef.current[id] = detail
      setDetailModal(detail)
    } catch (err) {
      console.error(err)
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
    setAreaStats(null)

    try {
      const data = await fetchPeers(selectedId, level)
      const ids  = new Set((data.peers ?? []).map(p => p.id))
      setPeerIds(ids)
      setPeerMeta({ total: data.total, areaName: data.area_name ?? level, level, geocode: data.area_geocode })

      // Fetch area stats for numeric fields in background
      if (schema.length > 0 && data.area_geocode) {
        fetchAreaStats(data.area_geocode)
          .then(s => setAreaStats(s.stats ?? null))
          .catch(() => {})
      }
    } catch (err) {
      console.error(err)
    } finally {
      setPeerLoading(false)
    }
  }, [selectedId, entityDetail, schema])

  // ── Exit peer mode ────────────────────────────────────────────────────────
  const onExitPeerMode = useCallback(() => {
    setPeerIds(null)
    setPeerMeta(null)
    setAreaStats(null)
    setActiveLevel(null)
  }, [])

  // ── Full reset ────────────────────────────────────────────────────────────
  const onClose = useCallback(() => {
    setSelectedId(null)
    setEntityDetail(null)
    setPanelOpen(false)
    setPeerIds(null)
    setPeerMeta(null)
    setAreaStats(null)
    setActiveLevel(null)
  }, [])

  // ── Upload success ────────────────────────────────────────────────────────
  const onUploaded = useCallback(async () => {
    setUploadOpen(false)
    setLoading(true)
    setLoadingMsg('Reloading entities…')
    onClose()
    detailCacheRef.current = {}
    const [data, sch] = await Promise.all([loadAllEntities(), fetchSchema()])
    setEntities(data)
    setSchema(sch.fields ?? [])
    setLoading(false)
  }, [onClose])

  const peerMode = peerIds !== null

  return (
    <>
      <Navbar
        entityCount={Object.keys(entities).length}
        peerMeta={peerMeta}
        peerMode={peerMode}
        onReset={onClose}
        onExitPeerMode={onExitPeerMode}
        onUploadClick={() => setUploadOpen(true)}
      />

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
        areaStats={areaStats}
        schema={schema}
        onLevelSelect={onLevelSelect}
        onClose={onClose}
        onExitPeerMode={onExitPeerMode}
        onToggle={() => setPanelOpen(v => !v)}
      />

      <EntityDetailModal
        entity={detailModal}
        loading={modalLoading}
        schema={schema}
        onClose={() => setDetailModal(null)}
      />

      <UploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onSuccess={onUploaded}
      />

      {loading && <LoadingScreen message={loadingMsg} />}
    </>
  )
}
