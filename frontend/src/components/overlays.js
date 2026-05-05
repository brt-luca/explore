/**
 * components/overlays.js
 * Overlay live e natura:
 * - RainViewer: radar pioggia animato (no key, aggiornato ogni 10min)
 * - Aree protette: poligoni da OSM via GeoJSON statico
 */

// ── RainViewer ───────────────────────────────────────────────────────────────

const RAINVIEWER_API = 'https://api.rainviewer.com/public/weather-maps.json'
const RAIN_OPACITY   = 0.7
const RAIN_SIZE      = 512  // tile size
const RAIN_COLOR     = 2    // schema colori: 0=originale, 1=universale, 2=TITAN
const RAIN_SMOOTH    = 1    // 1=smoothed
const RAIN_SNOW      = 1    // 1=mostra neve in blu

// Stato animazione
const rainState = {
  frames: [],       // array di path disponibili (ultimi ~12 frame)
  position: 0,      // frame corrente
  timer: null,      // setInterval animazione
  playing: false,
  loaded: false,
  host: '',
}

// RainViewer supporta zoom 1-8 circa — oltre mostra "zoom level not supported"
const RAIN_MINZOOM = 1
const RAIN_MAXZOOM = 8

export async function initRainViewer(map) {
  try {
    const res  = await fetch(RAINVIEWER_API)
    const data = await res.json()

    rainState.host   = data.host
    rainState.frames = data.radar.past
    rainState.loaded = true

    for (let i = 0; i < rainState.frames.length; i++) {
      const frame = rainState.frames[i]
      const srcId = `rain-${i}`

      map.addSource(srcId, {
        type: 'raster',
        tiles: [`${data.host}${frame.path}/${RAIN_SIZE}/{z}/{x}/{y}/${RAIN_COLOR}/${RAIN_SMOOTH}_${RAIN_SNOW}.png`],
        tileSize: RAIN_SIZE,
        attribution: '© <a href="https://rainviewer.com">RainViewer</a>',
      })

      map.addLayer({
        id: srcId,
        type: 'raster',
        source: srcId,
        minzoom: RAIN_MINZOOM,
        maxzoom: RAIN_MAXZOOM,  // nasconde il layer oltre zoom 8 → niente messaggio
        layout: { visibility: 'none' },
        paint: { 'raster-opacity': RAIN_OPACITY },
      })
    }

    rainState.position = rainState.frames.length - 1
    updateRainTimestamp()

  } catch (err) {
    console.warn('RainViewer non disponibile:', err)
  }
}

function showRainFrame(map, index) {
  // Nasconde tutti i frame
  for (let i = 0; i < rainState.frames.length; i++) {
    const id = `rain-${i}`
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, 'visibility', 'none')
    }
  }
  // Mostra solo il frame richiesto
  const id = `rain-${index}`
  if (map.getLayer(id)) {
    map.setLayoutProperty(id, 'visibility', 'visible')
    rainState.position = index
    updateRainTimestamp()
  }
}

function updateRainTimestamp() {
  const el = document.getElementById('rain-timestamp')
  if (!el || !rainState.frames.length) return
  const frame = rainState.frames[rainState.position]
  if (!frame) return
  const date = new Date(frame.time * 1000)
  el.textContent = date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
}

export function setRainVisibility(map, visible) {
  if (!rainState.loaded) return
  const id = `rain-${rainState.position}`
  if (map.getLayer(id)) {
    map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none')
  }
  if (!visible) stopRainAnimation(map)
}

export function playRainAnimation(map) {
  if (!rainState.loaded) return
  if (rainState.playing) { stopRainAnimation(map); return }

  rainState.playing = true
  document.getElementById('btn-rain-play')?.classList.add('playing')

  rainState.timer = setInterval(() => {
    const next = (rainState.position + 1) % rainState.frames.length
    showRainFrame(map, next)
  }, 600)
}

export function stopRainAnimation(map) {
  rainState.playing = false
  clearInterval(rainState.timer)
  document.getElementById('btn-rain-play')?.classList.remove('playing')
}

export function stepRainFrame(map, delta) {
  if (!rainState.loaded) return
  const next = (rainState.position + delta + rainState.frames.length) % rainState.frames.length
  showRainFrame(map, next)
}

export function setRainOpacity(map, opacity) {
  for (let i = 0; i < rainState.frames.length; i++) {
    const id = `rain-${i}`
    if (map.getLayer(id)) {
      map.setPaintProperty(id, 'raster-opacity', opacity)
    }
  }
}

// ── Aree protette (WDPA via UNEP-WCMC MapServer) ─────────────────────────────
// Fonte ufficiale: data-gis.unep-wcmc.org — aggiornato mensilmente
// Nota: max zoom 12 per questo servizio

const WDPA_TILE_URL =
  'https://data-gis.unep-wcmc.org/server/rest/services/ProtectedSites/' +
  'The_World_Database_of_Protected_Areas/MapServer/tile/{z}/{y}/{x}'

export async function initProtectedAreas(map) {
  map.addSource('protected-areas', {
    type: 'raster',
    tiles: [WDPA_TILE_URL],
    tileSize: 256,
    minzoom: 2,
    maxzoom: 12,
    attribution: '© <a href="https://www.protectedplanet.net">WDPA/UNEP-WCMC</a>',
  })

  map.addLayer(
    {
      id: 'protected-areas-fill',
      type: 'raster',
      source: 'protected-areas',
      layout: { visibility: 'none' },
      paint: { 'raster-opacity': 0.6 },
    },
    getFirstSymbolLayer(map)
  )
}

function getFirstSymbolLayer(map) {
  const layers = map.getStyle().layers
  for (const l of layers) {
    if (l.type === 'symbol') return l.id
  }
  return undefined
}

export function setProtectedAreasVisibility(map, visible) {
  if (map.getLayer('protected-areas-fill')) {
    map.setLayoutProperty('protected-areas-fill', 'visibility', visible ? 'visible' : 'none')
  }
  if (map.getLayer('protected-areas-names')) {
    map.setLayoutProperty('protected-areas-names', 'visibility', visible ? 'visible' : 'none')
  }
}

export function setProtectedAreasOpacity(map, opacity) {
  if (map.getLayer('protected-areas-fill')) {
    map.setPaintProperty('protected-areas-fill', 'raster-opacity', opacity)
  }
  if (map.getLayer('protected-areas-names')) {
    map.setPaintProperty('protected-areas-names', 'text-opacity', opacity * 0.9)
  }
}

// ── Nomi aree protette da OSM ─────────────────────────────────────────────────
// Layer vettoriale separato — etichette discrete collegate all'opacità slider

export async function initProtectedAreaNames(map) {
  // Carica nomi da GeoJSON statico pre-generato
  // Se non esiste, il layer è silenziosamente vuoto
  let data = { type: 'FeatureCollection', features: [] }
  try {
    const res = await fetch('/geojson/protected_area_names.geojson')
    if (res.ok) data = await res.json()
  } catch { /* silenzioso */ }

  map.addSource('protected-names-src', {
    type: 'geojson',
    data,
  })

  map.addLayer({
    id: 'protected-areas-names',
    type: 'symbol',
    source: 'protected-names-src',
    minzoom: 6,
    layout: {
      visibility: 'none',
      'text-field': ['get', 'name'],
      'text-font': ['Open Sans Italic'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 6, 9, 12, 13],
      'text-max-width': 10,
      'text-anchor': 'center',
      'text-allow-overlap': false,
    },
    paint: {
      'text-color': '#1a5c3a',
      'text-opacity': 0.9,
      'text-halo-color': 'rgba(255,255,255,0.8)',
      'text-halo-width': 1.5,
    },
  })
}

// ── NASA FIRMS — incendi attivi ──────────────────────────────────────────────
// Dati aggiornati ogni 24h, copertura globale, risoluzione 375m (VIIRS)

const FIRMS_KEY = 'efa964bcb9d37283c4d90e08aa766633'

export async function initFirms(map) {
  // FIRMS fornisce tile WMS — li adattiamo come sorgente raster XYZ
  // Il parametro TIME=TODAY mostra le ultime 24h
  map.addSource('firms', {
    type: 'raster',
    tiles: [
      `https://firms.modaps.eosdis.nasa.gov/mapserver/wms/fires/` +
      `${FIRMS_KEY}/` +
      `?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap` +
      `&LAYERS=fires_viirs_snpp_24hrs` +
      `&FORMAT=image/png&TRANSPARENT=true` +
      `&WIDTH=256&HEIGHT=256&SRS=EPSG:3857` +
      `&BBOX={bbox-epsg-3857}`
    ],
    tileSize: 256,
    attribution: '© <a href="https://firms.modaps.eosdis.nasa.gov">NASA FIRMS</a>',
  })

  map.addLayer({
    id: 'firms',
    type: 'raster',
    source: 'firms',
    minzoom: 3,
    layout: { visibility: 'none' },
    paint: { 'raster-opacity': 0.85 },
  })
}

export function setFirmsVisibility(map, visible) {
  if (!map.getLayer('firms')) return
  map.setLayoutProperty('firms', 'visibility', visible ? 'visible' : 'none')
}
