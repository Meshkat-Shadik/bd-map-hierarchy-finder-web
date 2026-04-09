const BASE = 'https://meshkatshadik-bd-hierarchy-location-finder.hf.space'

// ── Session ID ─────────────────────────────────────────────────────────────────
// Each browser/tab gets its own UUID stored in localStorage.
// This means each user uploads to their own isolated server-side data directory.
function getSessionId() {
  let id = localStorage.getItem('bdlf_session_id')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('bdlf_session_id', id)
  }
  return id
}

export const SESSION_ID = getSessionId()

// ── Entity loading ─────────────────────────────────────────────────────────────

/**
 * Load all entities in ONE request.
 * Returns { entities, displayField, truncated, nTotal }.
 */
export async function loadAllEntities() {
  const data = await get(`/entities/all?session_id=${SESSION_ID}`)
  const entities = {}
  for (const e of data.entities ?? []) entities[e.id] = e
  return {
    entities,
    displayField: data.display_field ?? 'id',
    truncated:    data.truncated ?? false,
    nTotal:       data.n_entities ?? 0,
  }
}

export const loadClusters = (zoom) =>
  get(`/entities/clustered?zoom=${zoom}&session_id=${SESSION_ID}`)

export const fetchEntityDetail = (id) =>
  get(`/entity/${encodeURIComponent(id)}?session_id=${SESSION_ID}`)

export const fetchPeers = (id, level) =>
  get(`/entity/${encodeURIComponent(id)}/peers?level=${level}&limit=10000&session_id=${SESSION_ID}`)

export const fetchSchema = () =>
  get(`/schema?session_id=${SESSION_ID}`)

export const fetchStatus = () =>
  get(`/status?session_id=${SESSION_ID}`)


export async function uploadCSV(file, extraFields = [], displayField = 'id') {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('session_id', SESSION_ID)
  fd.append('extra_fields', JSON.stringify(extraFields))
  fd.append('display_field', displayField)
  const res  = await fetch(`${BASE}/upload`, { method: 'POST', body: fd })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail ?? data.error ?? 'Upload failed')
  return data
}

async function get(path) {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) {
    const err = new Error(`API ${path} → ${res.status}`)
    err.status = res.status
    throw err
  }
  return res.json()
}

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`)
  return res.json()
}
