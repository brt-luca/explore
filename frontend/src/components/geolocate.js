/**
 * components/geolocate.js
 * Geolocalizzazione GPS con pulsante custom.
 */

import { showToast } from '../utils/toast.js'

export function initGeolocate(map) {
  const btn = document.getElementById('btn-geolocate')
  if (!btn) return

  btn.addEventListener('click', () => {
    if (!navigator.geolocation) {
      showToast('Geolocalizzazione non supportata dal browser')
      return
    }

    btn.classList.add('loading')

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        map.flyTo({ center: [lng, lat], zoom: 14, duration: 1000 })

        // Marker posizione corrente
        addLocationMarker(map, [lng, lat])
        btn.classList.remove('loading')
      },
      (err) => {
        btn.classList.remove('loading')
        const messages = {
          1: 'Permesso negato — abilita la posizione nel browser',
          2: 'Posizione non disponibile',
          3: 'Timeout — riprova',
        }
        showToast(messages[err.code] || 'Errore geolocalizzazione')
      },
      { timeout: 10000, maximumAge: 30000, enableHighAccuracy: true }
    )
  })
}

let locationMarker = null

function addLocationMarker(map, coords) {
  // Rimuovi il marker precedente se esiste
  locationMarker?.remove()

  // Crea elemento SVG per il marker
  const el = document.createElement('div')
  el.className = 'location-marker'
  el.innerHTML = `
    <div class="location-dot"></div>
    <div class="location-pulse"></div>
  `

  locationMarker = new maplibregl.Marker({ element: el, anchor: 'center' })
    .setLngLat(coords)
    .addTo(map)
}
