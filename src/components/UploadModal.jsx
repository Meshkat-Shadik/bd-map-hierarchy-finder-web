import { useState, useRef, useEffect } from 'react'
import { X, Upload } from './Icons'
import { uploadCSV } from '../api'
import { saveCSV } from '../csvStore'

// ── Minimal browser CSV parser ────────────────────────────────────────────────
function parseCSVLine(line) {
  const fields = []
  let cur = '', inQ = false
  for (const ch of line.trimEnd()) {
    if (ch === '"') { inQ = !inQ }
    else if (ch === ',' && !inQ) { fields.push(cur.trim()); cur = '' }
    else { cur += ch }
  }
  fields.push(cur.trim())
  return fields
}

function readCSVMeta(text) {
  const lines   = text.split('\n').filter(l => l.trim())
  if (!lines.length) return { headers: [], rows: 0 }
  const headers = parseCSVLine(lines[0])
  return { headers, rowCount: lines.length - 1, lines }
}

// Validate: check selected extra fields are non-empty for each row
function validateCSV(lines, headers, extraFields) {
  const issues = []
  for (let i = 1; i < lines.length; i++) {
    const vals    = parseCSVLine(lines[i])
    const rowObj  = Object.fromEntries(headers.map((h, j) => [h, vals[j] ?? '']))
    const missing = extraFields.filter(f => !rowObj[f]?.trim())
    if (missing.length) issues.push({ row: i + 1, missing })
  }
  return issues
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function UploadModal({ open, onClose, onSuccess }) {
  // step: 'pick' | 'schema' | 'validate' | 'processing'
  const [step,        setStep]        = useState('pick')
  const [csvFile,     setCsvFile]     = useState(null)
  const [csvHeaders,  setCsvHeaders]  = useState([])
  const [csvRowCount, setCsvRowCount] = useState(0)
  const [csvLines,    setCsvLines]    = useState([])
  const [selected,    setSelected]    = useState(new Set())
  const [displayField,setDisplayField]= useState('id')
  const [issues,      setIssues]      = useState([])
  const [progress,    setProgress]    = useState(0)
  const [statusText,  setStatusText]  = useState('')
  const [error,       setError]       = useState('')

  const fileInputRef = useRef(null)
  const dropRef      = useRef(null)

  const RESERVED = new Set(['id', 'lat', 'lng', 'latitude', 'longitude', 'lon', 'long'])

  // Auto-trigger upload when step changes to 'processing'
  useEffect(() => {
    if (step === 'processing' && progress === 0) {
      startServerUpload()
    }
  }, [step])

  function reset() {
    setStep('pick'); setCsvFile(null); setCsvHeaders([]); setCsvRowCount(0)
    setCsvLines([]); setSelected(new Set()); setDisplayField('id'); setIssues([])
    setProgress(0); setStatusText(''); setError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleClose() {
    if (step === 'processing') return
    reset(); onClose()
  }

  // ── Step 1: file picked ────────────────────────────────────────────────────
  function handleFile(file) {
    if (!file?.name?.toLowerCase().endsWith('.csv')) {
      setError('Please select a .csv file.'); return
    }
    setError('')
    const reader = new FileReader()
    reader.onload = e => {
      const text = e.target.result
      const { headers, rowCount, lines } = readCSVMeta(text)
      if (!headers.length) { setError('Could not parse CSV headers.'); return }

      const hasLat = headers.some(h => ['lat','latitude'].includes(h.toLowerCase()))
      const hasLng = headers.some(h => ['lng','lon','long','longitude'].includes(h.toLowerCase()))
      if (!hasLat || !hasLng) {
        setError(`CSV must have lat and lng columns. Found: ${headers.join(', ')}`)
        return
      }

      setCsvFile(file)
      setCsvHeaders(headers)
      setCsvRowCount(rowCount)
      setCsvLines(lines)
      const autoExtra = new Set(headers.filter(h => !RESERVED.has(h.toLowerCase())))
      setSelected(autoExtra)
      const defaultDisplay = headers.find(h => h.toLowerCase() === 'id') || headers[0] || 'id'
      setDisplayField(defaultDisplay)

      setStep('schema')
    }
    reader.readAsText(file)
  }

  // ── Step 2: toggle field ───────────────────────────────────────────────────
  function toggleField(h) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(h) ? next.delete(h) : next.add(h)
      return next
    })
  }

  // ── Step 3: validate ───────────────────────────────────────────────────────
  function runValidation() {
    const extraArr     = [...selected]
    const foundIssues  = validateCSV(csvLines, csvHeaders, extraArr)
    setIssues(foundIssues)
    setStep('validate')
  }

  // ── Step 4: upload to server ───────────────────────────────────────────────
  async function startServerUpload() {
    if (!csvFile) return
    setProgress(10)
    setStatusText('Uploading to server…')

    try {
      const selectedArr = [...selected]
      await uploadCSV(csvFile, selectedArr, displayField)

      // Persist raw CSV to IndexedDB so it can be auto-reuploaded on session expiry
      await saveCSV(csvFile, { displayField, extraFields: selectedArr })

      setProgress(95)
      setStatusText('Build started on server…')
      await sleep(500)
      setProgress(100)
      setStatusText('Ready!')
      await sleep(900)
      reset()
      onSuccess({ isLocal: false })
    } catch (err) {
      setError(`Upload failed: ${err.message}`)
      setStep('validate')
    }
  }

  // ── Drag-and-drop ──────────────────────────────────────────────────────────
  function onDragOver(e) { e.preventDefault(); dropRef.current?.classList.add('drag-over') }
  function onDragLeave() { dropRef.current?.classList.remove('drag-over') }
  function onDrop(e) {
    e.preventDefault(); dropRef.current?.classList.remove('drag-over')
    handleFile(e.dataTransfer?.files?.[0])
  }

  const extraHeaders = csvHeaders.filter(h => !RESERVED.has(h.toLowerCase()))
  const selectedArr  = [...selected]
  const okRows       = csvRowCount - issues.length

  if (!open) return null

  return (
    <div className="modal-backdrop modal-open"
      onClick={e => e.target === e.currentTarget && handleClose()}>
      <div className="modal upload-modal" role="dialog" aria-modal="true">

        {/* ── Header ── */}
        <div className="modal-header">
          <div>
            <h2 className="modal-title">
              { step === 'pick'       && 'Upload Locations' }
              { step === 'schema'     && 'Select Extra Fields' }
              { step === 'validate'   && 'Validation Results' }
              { step === 'processing' && 'Processing…' }
            </h2>
            <p className="modal-sub">
              { step === 'pick'       && 'Load your dataset into this browser' }
              { step === 'schema'     && `${csvRowCount.toLocaleString()} rows · choose which columns to store` }
              { step === 'validate'   && `${csvFile?.name}` }
              { step === 'processing' && 'Uploading to server…' }
            </p>
          </div>
          <button className="btn-close" onClick={handleClose}
            disabled={step === 'processing'} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {/* ── Step indicator ── */}
        {step !== 'processing' && (
          <div className="upload-steps">
            {['pick','schema','validate'].map((s, i) => (
              <div key={s} className={`upload-step ${step === s ? 'active' : ''} ${
                ['pick','schema','validate'].indexOf(step) > i ? 'done' : ''}`}>
                <span className="step-num">{i + 1}</span>
                <span className="step-label">{['File','Fields','Validate'][i]}</span>
              </div>
            ))}
          </div>
        )}

        {/* ════════════════ STEP 1: PICK ════════════════ */}
        {step === 'pick' && (
          <>
            <div ref={dropRef} className="drop-zone" tabIndex={0} role="button"
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={e => e.key === 'Enter' && fileInputRef.current?.click()}
              onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
              <Upload size={28} className="drop-icon" />
              <p className="drop-title">Drop CSV here</p>
              <p className="drop-hint">or <span className="link">browse files</span></p>
              <input ref={fileInputRef} type="file" accept=".csv" hidden
                onChange={e => handleFile(e.target.files?.[0])} />
            </div>
            <p className="modal-format">
              Required: <code>lat</code>, <code>lng</code> — Optional: <code>id</code>, any extra columns
            </p>
            <p className="modal-local-note">
              Your CSV is uploaded to the server for geocoding. The raw file is also saved
              in this browser so data restores automatically if the session expires.
            </p>
            {error && <p className="upload-error">{error}</p>}
          </>
        )}

        {/* ════════════════ STEP 2: SCHEMA ════════════════ */}
        {step === 'schema' && (
          <>
            <div className="schema-required">
              <div className="schema-section-label">Required columns (always included)</div>
              <div className="schema-required-chips">
                {csvHeaders.filter(h => RESERVED.has(h.toLowerCase())).map(h => (
                  <span key={h} className="schema-chip required">{h}</span>
                ))}
              </div>
            </div>

            {extraHeaders.length > 0 ? (
              <>
                <div className="schema-section-label" style={{marginTop:'14px'}}>
                  Extra fields — stored as metadata per location
                </div>
                <div className="schema-fields">
                  {extraHeaders.map(h => (
                    <label key={h} className={`schema-field-row ${selected.has(h) ? 'checked' : ''}`}>
                      <input type="checkbox" checked={selected.has(h)}
                        onChange={() => toggleField(h)} />
                      <span className="schema-field-name">{h}</span>
                      <span className={`schema-field-type ${detectFieldType(h)}`}>
                        {detectFieldType(h)}
                      </span>
                    </label>
                  ))}
                </div>
                <div className="schema-hint">
                  {selectedArr.length} field{selectedArr.length !== 1 ? 's' : ''} selected
                </div>
              </>
            ) : (
              <p className="schema-no-extra">No extra columns detected. Only lat/lng/id will be stored.</p>
            )}

            {/* Display Field Selector */}
            <div className="schema-section-label" style={{marginTop:'20px'}}>
              Label field — shown on map markers
            </div>
            <div className="display-field-selector">
              <select
                value={displayField}
                onChange={e => setDisplayField(e.target.value)}
                className="display-field-select"
              >
                {csvHeaders.map(h => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
              <div className="display-field-hint">
                This field will appear as the location label on the map
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setStep('pick')}>Back</button>
              <button className="btn-action" onClick={runValidation}>
                Validate CSV →
              </button>
            </div>
          </>
        )}

        {/* ════════════════ STEP 3: VALIDATE ════════════════ */}
        {step === 'validate' && (
          <>
            <div className="validate-summary">
              <div className={`validate-badge ${issues.length === 0 ? 'ok' : 'warn'}`}>
                {issues.length === 0 ? '✓' : '⚠'}
              </div>
              <div>
                <div className="validate-main">
                  {okRows.toLocaleString()} rows valid
                  {issues.length > 0 && `, ${issues.length.toLocaleString()} with missing fields`}
                </div>
                <div className="validate-sub">
                  {selectedArr.length > 0
                    ? `Extra fields: ${selectedArr.join(', ')}`
                    : 'No extra fields selected'}
                </div>
              </div>
            </div>

            {issues.length > 0 && (
              <div className="issues-list">
                <div className="issues-header">First {Math.min(issues.length, 20)} issues:</div>
                {issues.slice(0, 20).map(({ row, missing }) => (
                  <div key={row} className="issue-row">
                    <span className="issue-row-num">Row {row}</span>
                    <span className="issue-missing">missing: {missing.join(', ')}</span>
                  </div>
                ))}
                {issues.length > 20 && (
                  <div className="issues-more">…and {issues.length - 20} more</div>
                )}
              </div>
            )}

            {error && <p className="upload-error">{error}</p>}

            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setStep('schema')}>Back</button>
              <button className="btn-action" onClick={() => setStep('processing')}>
                {issues.length > 0 ? 'Upload anyway' : 'Upload to server'}
              </button>
            </div>
          </>
        )}

        {/* ════════════════ STEP 4: PROCESSING ════════════════ */}
        {step === 'processing' && (
          <div className="upload-progress">
            <div className="progress-track">
              <div className={`progress-fill ${progress === 100 ? 'done' : ''}`}
                style={{ width: `${progress}%` }} />
            </div>
            <p className="progress-text">{statusText}</p>
          </div>
        )}

      </div>
    </div>
  )
}

// Detect field type for display label only
function detectFieldType(key) {
  const k = key.toLowerCase()
  if (/salary|revenue|income|amount|price|cost|fee|budget/.test(k)) return 'money'
  if (/phone|mobile|contact|tel/.test(k))                            return 'phone'
  if (/stock|count|quantity|unit/.test(k))                          return 'quantity'
  if (/name|manager|owner|employee/.test(k))                        return 'person'
  return 'text'
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
