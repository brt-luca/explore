/**
 * utils/storage.js
 * Salva e carica lo stato dell'applicazione in localStorage.
 */

const STORAGE_KEY = 'mappa-esplorativa-state'

export function saveState(partial) {
  try {
    const current = loadState() || {}
    const updated = { ...current, ...partial }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  } catch (e) {
    // localStorage può fallire in modalità privata o storage pieno
    console.warn('localStorage non disponibile:', e)
  }
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function clearState() {
  localStorage.removeItem(STORAGE_KEY)
}
