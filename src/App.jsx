import { useState, useEffect, useCallback } from 'react'
import MapView from './components/MapView'
import Navbar from './components/Navbar'
import EntityPanel from './components/EntityPanel'
import UploadModal from './components/UploadModal'
import LoadingScreen from './components/LoadingScreen'
import { loadAllEntities, fetchEntityDetail, fetchPeers } from './api'

export default function App() {
  // ── Data ──────────────────────────────────────────────────────────────────
  const [entities, setEntities]       = useState({})
  const [loading, setLoading]         = useState(true)
  const [loadingMsg, setLoadingMsg]   = useState('Loading entities…')

  // ── Selection ─────────────────────────────────────────────────────────────
  const [selectedId, setSelectedId]       = useState(null)
  const [entityDetail, setEntityDetail]   = useState(null)
  const [panelOpen, setPanelOpen]         = useState(false)

  // ── Peer highlight ────────────────────────────────────────────────────────
  const [peerIds, setPeerIds]       = useState(null)   // Set<id> | null
  const [peerMeta, setPeerMeta]     = useState(null)   // {total, areaName, level}
  const [peerLoading, setPeerLoading] = useState(false)
  const [activeLevel, setActiveLevel] = useState(null)

  // ── Modal ─────────────────────────────────────────────────────────────────
  const [uploadOpen, setUploadOpen] = useState(false)

  // ── Boot ──────────────────────────────────────────────────────────────────
  useEffect(() => { boot() }, [])

  async function boot() {
    try {
      const data = await loadAllEntities()
      setEntities(data)
    } catch (err) {
      console.error(err)
      setLoadingMsg('Failed to load. Check console.')
      return
    }
    setLoading(false)
  }

  // ── Marker click ──────────────────────────────────────────────────────────
  const onMarkerClick = useCallback(async (id) => {
    setSelectedId(id)
    setActiveLevel(null)
    setPeerIds(null)
    setPeerMeta(null)
    setPanelOpen(true)
    setEntityDetail(null)

    try {
      const detail = await fetchEntityDetail(id)
      setEntityDetail(detail)
    } catch (err) {
      console.error(err)
    }
  }, [])

  // ── Level select ──────────────────────────────────────────────────────────
  const onLevelSelect = useCallback(async (level) => {
    if (!selectedId) return
    setActiveLevel(level)
    setPeerLoading(true)
    setPeerIds(null)

    try {
      const data = await fetchPeers(selectedId, level)
      const ids = new Set((data.peers ?? []).map(p => p.id))
      setPeerIds(ids)
      setPeerMeta({ total: data.total, areaName: data.area_name ?? level, level })
    } catch (err) {
      console.error(err)
    } finally {
      setPeerLoading(false)
    }
  }, [selectedId])

  // ── Close / reset ─────────────────────────────────────────────────────────
  const onClose = useCallback(() => {
    setSelectedId(null)
    setEntityDetail(null)
    setPanelOpen(false)
    setPeerIds(null)
    setPeerMeta(null)
    setActiveLevel(null)
  }, [])

  // ── Upload success ────────────────────────────────────────────────────────
  const onUploaded = useCallback(async () => {
    setUploadOpen(false)
    setLoading(true)
    setLoadingMsg('Reloading entities…')
    onClose()
    const data = await loadAllEntities()
    setEntities(data)
    setLoading(false)
  }, [onClose])

  // ── Derive dim mode ───────────────────────────────────────────────────────
  const dimMode = peerIds !== null

  return (
    <>
      <Navbar
        entityCount={Object.keys(entities).length}
        peerMeta={peerMeta}
        onReset={onClose}
        onUploadClick={() => setUploadOpen(true)}
      />

      <MapView
        entities={entities}
        selectedId={selectedId}
        peerIds={peerIds}
        dimMode={dimMode}
        onMarkerClick={onMarkerClick}
        onMapClick={onClose}
      />

      <EntityPanel
        open={panelOpen}
        entity={entityDetail}
        selectedId={selectedId}
        activeLevel={activeLevel}
        peerMeta={peerMeta}
        peerLoading={peerLoading}
        onLevelSelect={onLevelSelect}
        onClose={onClose}
        onToggle={() => setPanelOpen(v => !v)}
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
