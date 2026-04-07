import { useState, useRef } from 'react'
import { X, Upload } from './Icons'
import { uploadCSV, fetchStatus } from '../api'

const STAGES = {
  idle:     { pct: 0,   text: '' },
  upload:   { pct: 15,  text: 'Uploading file…' },
  building: { pct: 40,  text: 'Building index…' },
  done:     { pct: 100, text: 'Done! Reloading map…' },
  error:    { pct: 0,   text: '' },
}

export default function UploadModal({ open, onClose, onSuccess }) {
  const [stage, setStage]     = useState('idle')
  const [progress, setProgress] = useState(0)
  const [statusText, setStatusText] = useState('')
  const [error, setError]     = useState('')
  const fileInputRef = useRef(null)
  const dropRef      = useRef(null)

  function reset() {
    setStage('idle')
    setProgress(0)
    setStatusText('')
    setError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleClose() {
    if (stage === 'upload' || stage === 'building') return // block close during upload
    reset()
    onClose()
  }

  async function handleFile(file) {
    if (!file?.name?.toLowerCase().endsWith('.csv')) {
      setError('Please select a .csv file.')
      return
    }

    setError('')
    setStage('upload')
    setProgress(15)
    setStatusText('Uploading file…')

    try {
      await uploadCSV(file)
      setStage('building')
      setProgress(40)
      setStatusText('Building index…')
      await pollBuild()
      setStage('done')
      setProgress(100)
      setStatusText('Done! Reloading map…')
      await sleep(1200)
      reset()
      onSuccess()
    } catch (err) {
      setStage('error')
      setError(err.message)
    }
  }

  async function pollBuild() {
    for (let i = 0; i < 60; i++) {
      await sleep(2000)
      const s = await fetchStatus()
      if (!s.build_running) {
        if (s.build_result?.success) {
          setStatusText(`Built ${(s.build_result.valid ?? 0).toLocaleString()} entities`)
          setProgress(90)
          return
        }
        if (s.build_result?.error) throw new Error(s.build_result.error)
      }
      const pct = 40 + Math.min(45, i * 2)
      setProgress(pct)
      setStatusText(`Building… ${(s.n_entities ?? 0).toLocaleString()} entities`)
    }
    throw new Error('Build timed out after 2 minutes.')
  }

  // Drag-and-drop
  function onDragOver(e) { e.preventDefault(); dropRef.current?.classList.add('drag-over') }
  function onDragLeave()  { dropRef.current?.classList.remove('drag-over') }
  function onDrop(e) {
    e.preventDefault()
    dropRef.current?.classList.remove('drag-over')
    handleFile(e.dataTransfer?.files?.[0])
  }

  const busy = stage === 'upload' || stage === 'building'

  return (
    <div className={`modal-backdrop ${open ? 'modal-open' : ''}`} onClick={e => e.target === e.currentTarget && handleClose()}>
      <div className="modal" role="dialog" aria-modal="true">

        <div className="modal-header">
          <div>
            <h2 className="modal-title">Upload Locations</h2>
            <p className="modal-sub">Replace the current dataset</p>
          </div>
          <button className="btn-close" onClick={handleClose} disabled={busy} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {/* Drop zone — hidden once upload starts */}
        {stage === 'idle' || stage === 'error' ? (
          <>
            <div
              ref={dropRef}
              className="drop-zone"
              tabIndex={0}
              role="button"
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={e => e.key === 'Enter' && fileInputRef.current?.click()}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
            >
              <Upload size={28} className="drop-icon" />
              <p className="drop-title">Drop CSV here</p>
              <p className="drop-hint">or <span className="link">browse files</span></p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                hidden
                onChange={e => handleFile(e.target.files?.[0])}
              />
            </div>
            <p className="modal-format">
              Required columns: <code>lat</code>, <code>lng</code> — optional: <code>id</code>
            </p>
            {error && <p className="upload-error">{error}</p>}
          </>
        ) : (
          <div className="upload-progress">
            <div className="progress-track">
              <div
                className={`progress-fill ${stage === 'done' ? 'done' : ''}`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="progress-text">{statusText}</p>
          </div>
        )}

      </div>
    </div>
  )
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
