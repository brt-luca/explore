/**
 * main.js — Entry point dell'applicazione Mappa Esplorativa
 *
 * Inizializza la mappa e collega tutti i moduli.
 * Ogni modulo è responsabile di una funzionalità specifica.
 */

import maplibregl from 'maplibre-gl'
import { initMap } from './components/map.js'
import { initPanel } from './components/panel.js'
import { initSearch } from './components/search.js'
import { initGeolocate } from './components/geolocate.js'
import { initSecrets } from './components/secrets.js'
import { initRainViewer, initProtectedAreas, initProtectedAreaNames, initFirms } from './components/overlays.js'
import { loadState, saveState } from './utils/storage.js'

async function main() {
  const savedState = loadState()

  const map = await initMap({ container: 'map', savedState })

  initPanel(map)
  initSearch(map)
  initGeolocate(map)
  await initSecrets(map)
  await initRainViewer(map)
  await initProtectedAreas(map)
  await initProtectedAreaNames(map)
  await initFirms(map)

  window.__map = map

  map.on('moveend', () => {
    saveState({ center: map.getCenter(), zoom: map.getZoom() })
  })

  console.log('🗺️ Mappa Esplorativa — pronta')
}

main().catch((err) => {
  console.error('Errore durante il caricamento della mappa:', err)
})
