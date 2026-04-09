/**
 * csvStore.js — IndexedDB wrapper for persisting the raw CSV file.
 *
 * Stores the uploaded CSV as an ArrayBuffer alongside field-selection metadata
 * so it can be auto-reuploaded if the server session expires (24-hour TTL).
 *
 * DB:    bdlf_store  (version 1)
 * Store: csv         (keyPath: 'key', single record at key 'current')
 */

const DB_NAME    = 'bdlf_store'
const DB_VERSION = 1
const STORE_NAME = 'csv'
const RECORD_KEY = 'current'

let dbPromise = null

function openDB() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = e => {
      e.target.result.createObjectStore(STORE_NAME, { keyPath: 'key' })
    }
    req.onsuccess = e => resolve(e.target.result)
    req.onerror   = e => reject(e.target.error)
  })
  return dbPromise
}

/**
 * Persist the CSV file alongside field-selection metadata.
 * Overwrites any previously stored record.
 */
export async function saveCSV(file, { displayField, extraFields }) {
  try {
    const db     = await openDB()
    const buffer = await file.arrayBuffer()
    await new Promise((resolve, reject) => {
      const tx    = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const req   = store.put({
        key:          RECORD_KEY,
        fileBuffer:   buffer,
        fileName:     file.name,
        fileType:     file.type || 'text/csv',
        displayField: displayField || 'id',
        extraFields:  extraFields  || [],
        savedAt:      new Date().toISOString(),
      })
      req.onsuccess = () => resolve()
      req.onerror   = e => reject(e.target.error)
    })
  } catch (err) {
    console.warn('[csvStore] saveCSV failed:', err)
  }
}

/**
 * Load the stored CSV record.
 * Returns { file, displayField, extraFields, savedAt } or null.
 */
export async function loadCSV() {
  try {
    const db     = await openDB()
    const record = await new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).get(RECORD_KEY)
      req.onsuccess = e => resolve(e.target.result ?? null)
      req.onerror   = e => reject(e.target.error)
    })
    if (!record) return null
    const file = new File([record.fileBuffer], record.fileName, { type: record.fileType })
    return {
      file,
      displayField: record.displayField,
      extraFields:  record.extraFields,
      savedAt:      record.savedAt,
    }
  } catch (err) {
    console.warn('[csvStore] loadCSV failed:', err)
    return null
  }
}

/** Remove the stored CSV record. */
export async function clearCSV() {
  try {
    const db = await openDB()
    await new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE_NAME, 'readwrite')
      const req = tx.objectStore(STORE_NAME).delete(RECORD_KEY)
      req.onsuccess = () => resolve()
      req.onerror   = e => reject(e.target.error)
    })
  } catch (err) {
    console.warn('[csvStore] clearCSV failed:', err)
  }
}

/**
 * Fast existence check — counts records without loading the ArrayBuffer.
 * Returns true if a CSV is stored, false otherwise.
 */
export async function hasCSV() {
  try {
    const db    = await openDB()
    const count = await new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).count()
      req.onsuccess = e => resolve(e.target.result)
      req.onerror   = e => reject(e.target.error)
    })
    return count > 0
  } catch (err) {
    console.warn('[csvStore] hasCSV failed:', err)
    return false
  }
}
