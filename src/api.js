const BASE = 'https://meshkatshadik-bd-hierarchy-location-finder.hf.space'

export async function loadAllEntities() {
  const { areas } = await get('/areas?level=division')

  const results = await Promise.all(
    areas.map(a => get(`/area/${a.geocode}?limit=10000`))
  )

  const entities = {}
  for (const r of results) {
    for (const e of r.entities ?? []) {
      entities[e.id] = e
    }
  }
  return entities
}

export const fetchEntityDetail = (id) =>
  get(`/entity/${encodeURIComponent(id)}`)

export const fetchPeers = (id, level) =>
  get(`/entity/${encodeURIComponent(id)}/peers?level=${level}&limit=10000`)

export const fetchStatus = () => get('/status')

export async function uploadCSV(file) {
  const fd = new FormData()
  fd.append('file', file)
  const res = await fetch(`${BASE}/upload`, { method: 'POST', body: fd })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail ?? data.error ?? 'Upload failed')
  return data
}

async function get(path) {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`)
  return res.json()
}
