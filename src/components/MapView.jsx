import { useEffect, useRef, useLayoutEffect } from 'react'
import L from 'leaflet'

const STYLE = {
  default:  { radius: 5, fillColor: '#4ecdc4', color: 'transparent', fillOpacity: 0.8,  weight: 0 },
  selected: { radius: 8, fillColor: '#f9c74f', color: '#fff',        fillOpacity: 1,    weight: 1.5 },
  peer:     { radius: 5, fillColor: '#ff6b6b', color: 'transparent', fillOpacity: 0.9,  weight: 0 },
  dim:      { radius: 4, fillColor: '#2d3139', color: 'transparent', fillOpacity: 0.5,  weight: 0 },
}

export default function MapView({ entities, selectedId, peerIds, dimMode, onMarkerClick, onMapClick }) {
  const containerRef = useRef(null)
  const mapRef       = useRef(null)
  const layerRef     = useRef(null)
  const markersRef   = useRef({})

  // Stable callback refs — avoids re-creating markers when callbacks change
  const onMarkerClickRef = useRef(onMarkerClick)
  const onMapClickRef    = useRef(onMapClick)
  useLayoutEffect(() => { onMarkerClickRef.current = onMarkerClick })
  useLayoutEffect(() => { onMapClickRef.current = onMapClick })

  // ── Init map once ─────────────────────────────────────────────────────────
  useEffect(() => {
    const map = L.map(containerRef.current, {
      center: [23.685, 90.356],
      zoom: 7,
      zoomControl: false,
      preferCanvas: true,
    })

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map)

    L.control.zoom({ position: 'bottomright' }).addTo(map)

    map.on('click', () => onMapClickRef.current?.())

    layerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map

    return () => map.remove()
  }, [])

  // ── Rebuild markers when entities change ──────────────────────────────────
  useEffect(() => {
    if (!layerRef.current) return
    layerRef.current.clearLayers()
    markersRef.current = {}

    const renderer = L.canvas({ padding: 0.5 })

    for (const entity of Object.values(entities)) {
      const m = L.circleMarker([entity.lat, entity.lng], { renderer, ...STYLE.default })
      m.bindTooltip(entity.id, { direction: 'top', offset: [0, -5], opacity: 0.9 })
      m.on('click', e => { L.DomEvent.stopPropagation(e); onMarkerClickRef.current(entity.id) })
      layerRef.current.addLayer(m)
      markersRef.current[entity.id] = m
    }
  }, [entities])

  // ── Re-style markers on selection / peer change ───────────────────────────
  useEffect(() => {
    for (const [id, m] of Object.entries(markersRef.current)) {
      if (id === selectedId) {
        m.setStyle(STYLE.selected).bringToFront()
      } else if (peerIds?.has(id)) {
        m.setStyle(STYLE.peer)
      } else if (dimMode) {
        m.setStyle(STYLE.dim)
      } else {
        m.setStyle(STYLE.default)
      }
    }
  }, [selectedId, peerIds, dimMode])

  // ── Pan to selected entity ────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedId || !entities[selectedId] || !mapRef.current) return
    const { lat, lng } = entities[selectedId]
    mapRef.current.panTo([lat, lng], { animate: true, duration: 0.5 })
  }, [selectedId])

  return <div ref={containerRef} className="map-container" />
}
