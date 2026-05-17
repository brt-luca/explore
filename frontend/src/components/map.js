/**
 * components/map.js
 * Inizializza MapLibre GL, hillshade ESRI, overlay Waymarked Trails,
 * e curve di livello via maplibre-contour.
 */

import maplibregl from 'maplibre-gl'

const DEFAULT_CENTER    = [10.2118, 45.5416]
const DEFAULT_ZOOM      = 9
const BASEMAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'
const HILLSHADE_URL     = 'https://services.arcgisonline.com/arcgis/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}'

// URL DEM per curve di livello e terrain 3D (AWS Terrain Tiles, Terrarium encoding)
const DEM_URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'

// URL DEM formato terrain-rgb per il 3D terrain di MapLibre
const TERRAIN_RGB_URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'

// Waymarked Trails — overlay trasparenti, solo percorsi colorati sopra la mappa
export const WAYMARKED_OVERLAYS = [
  { id: 'wmt-hiking',  label: 'Sentieri escursionistici', emoji: '🥾', default: true,
    url: 'https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png' },
  { id: 'wmt-cycling', label: 'Ciclovie',                  emoji: '🚴', default: false,
    url: 'https://tile.waymarkedtrails.org/cycling/{z}/{x}/{y}.png' },
  { id: 'wmt-mtb',     label: 'Mountain bike',             emoji: '🚵', default: false,
    url: 'https://tile.waymarkedtrails.org/mtb/{z}/{x}/{y}.png' },
  { id: 'wmt-slopes',  label: 'Piste da sci',              emoji: '⛷️', default: false,
    url: 'https://tile.waymarkedtrails.org/slopes/{z}/{x}/{y}.png' },
]

// ── Inizializzazione ─────────────────────────────────────────────────────────

export async function initMap({ container, savedState }) {
  const center = savedState?.center ? [savedState.center.lng, savedState.center.lat] : DEFAULT_CENTER
  const zoom   = savedState?.zoom ?? DEFAULT_ZOOM

  const map = new maplibregl.Map({
    container,
    style: BASEMAP_STYLE_URL,
    center,
    zoom,
    minZoom: 3,
    maxZoom: 18,
    attributionControl: false,
  })

  map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')

  if (window.innerWidth > 768) {
    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'bottom-right')
  }

  await new Promise((resolve) => {
    if (map.isStyleLoaded()) resolve()
    else map.once('load', resolve)
  })

  addHillshadeLayer(map)
  addWaymarkedLayers(map)
  addTerrainSource(map)
  await addContourLayers(map)

  return map
}

// ── Hillshade ESRI ───────────────────────────────────────────────────────────

function addHillshadeLayer(map) {
  map.addSource('hillshade-esri', {
    type: 'raster',
    tiles: [HILLSHADE_URL],
    tileSize: 256,
    maxzoom: 16,
    attribution: 'Hillshade © <a href="https://www.esri.com">Esri</a>',
  })

  map.addLayer(
    {
      id: 'hillshade',
      type: 'raster',
      source: 'hillshade-esri',
      layout: { visibility: 'visible' },
      paint: { 'raster-opacity': 0.45, 'raster-resampling': 'linear' },
    },
    getFirstSymbolLayerId(map)
  )

  // Nasconde building-3d, forza building 2D visibile a tutti gli zoom
  if (map.getLayer('building-3d')) {
    map.setLayoutProperty('building-3d', 'visibility', 'none')
  }
  if (map.getLayer('building')) {
    // Rimuove il maxzoom che Liberty imposta sul layer building 2D
    // (Liberty lo nasconde a zoom alto per far posto al 3D)
    map.setLayerZoomRange('building', 0, 24)
  }

  // Sposta layer vegetazione sopra hillshade ma PRIMA di building
  // così gli edifici 2D restano sempre visibili sopra il verde
  const layersToFloat = [
    'landcover_wetland',
    'landcover_sand',
    'landcover_ice',
    'landcover_grass',
    'park',
    'park_outline',
    'landcover_wood',
  ]
  for (const id of layersToFloat) {
    if (map.getLayer(id) && map.getLayer('building')) {
      map.moveLayer(id, 'building')  // inserisce PRIMA di building = sotto building
    }
  }

  // Colori e opacità vegetazione — modifica qui per personalizzare
  if (map.getLayer('landcover_wood')) {
    map.setPaintProperty('landcover_wood', 'fill-color', '#4a8c3f')
    map.setPaintProperty('landcover_wood', 'fill-opacity', 0.45)
  }
  if (map.getLayer('landcover_grass')) {
    map.setPaintProperty('landcover_grass', 'fill-color', '#c8e6a0')
    map.setPaintProperty('landcover_grass', 'fill-opacity', 0.4)
  }
  if (map.getLayer('park')) {
    map.setPaintProperty('park', 'fill-color', '#a8d5a2')
    map.setPaintProperty('park', 'fill-opacity', 0.4)
  }
  if (map.getLayer('landcover_wetland')) {
    map.setPaintProperty('landcover_wetland', 'fill-color', '#7ec8c8')
    map.setPaintProperty('landcover_wetland', 'fill-opacity', 0.35)
  }
  if (map.getLayer('landcover_sand')) {
    map.setPaintProperty('landcover_sand', 'fill-color', '#e8d5a3')
    map.setPaintProperty('landcover_sand', 'fill-opacity', 0.5)
  }
  if (map.getLayer('landcover_ice')) {
    map.setPaintProperty('landcover_ice', 'fill-color', '#dff0f7')
    map.setPaintProperty('landcover_ice', 'fill-opacity', 0.55)
  }
}

// ── Waymarked Trails overlays ────────────────────────────────────────────────

function addWaymarkedLayers(map) {
  for (const overlay of WAYMARKED_OVERLAYS) {
    map.addSource(overlay.id, {
      type: 'raster',
      tiles: [overlay.url],
      tileSize: 256,
      minzoom: 5,
      maxzoom: 18,
      attribution: '© <a href="https://waymarkedtrails.org">Waymarked Trails</a> (CC-BY-SA)',
    })

    map.addLayer({
      id: overlay.id,
      type: 'raster',
      source: overlay.id,
      layout: { visibility: overlay.default ? 'visible' : 'none' },
      paint: { 'raster-opacity': 1.0 },
    })
  }
}

// ── Curve di livello (maplibre-contour) ──────────────────────────────────────

async function addContourLayers(map) {
  // Il plugin è caricato come script globale in index.html
  if (typeof window.mlcontour === 'undefined') {
    console.warn('maplibre-contour non disponibile')
    return
  }

  const demSource = new window.mlcontour.DemSource({
    url: DEM_URL,
    encoding: 'terrarium',
    maxzoom: 15,
    worker: true,
    cacheSize: 100,
  })

  demSource.setupMaplibre(maplibregl)

  // Sorgente vettoriale curve — generata on-the-fly dal DEM
  // maxzoom=15 sulla sorgente + overzoom abilitato → tile a zoom 15
  // vengono riusati per zoom 16, 17, 18
  map.addSource('contour-source', {
    type: 'vector',
    tiles: [
      demSource.contourProtocolUrl({
        thresholds: {
          9:  [500, 2000],
          10: [200, 1000],
          11: [100, 500],
          12: [50,  200],
          13: [25,  100],
          14: [10,  50],
          15: [5,   25],
        },
        contourLayer: 'contours',
        elevationKey: 'ele',
        levelKey: 'level',
      }),
    ],
  })

  const firstSymbol = getFirstSymbolLayerId(map)

  // minzoom sui layer (non sulla sorgente) controlla quando appaiono.
  // maxzoom NON impostato → MapLibre fa overzoom automatico dei tile vettoriali.
  map.addLayer(
    {
      id: 'contours-minor',
      type: 'line',
      source: 'contour-source',
      'source-layer': 'contours',
      filter: ['==', ['get', 'level'], 0],
      minzoom: 11,
      maxzoom: 24,
      layout: { visibility: 'visible', 'line-join': 'round' },
      paint: {
        'line-color': '#8a7a60',
        'line-width': 0.6,
        'line-opacity': 0,
      },
    },
    firstSymbol
  )

  map.addLayer(
    {
      id: 'contours-major',
      type: 'line',
      source: 'contour-source',
      'source-layer': 'contours',
      filter: ['==', ['get', 'level'], 1],
      minzoom: 10,
      maxzoom: 24,
      layout: { visibility: 'visible', 'line-join': 'round' },
      paint: {
        'line-color': '#6b5c3e',
        'line-width': 1.2,
        'line-opacity': 0,
      },
    },
    firstSymbol
  )

  map.addLayer({
    id: 'contours-label',
    type: 'symbol',
    source: 'contour-source',
    'source-layer': 'contours',
    filter: ['==', ['get', 'level'], 1],
    minzoom: 12,
    maxzoom: 24,
    layout: {
      visibility: 'visible',
      'symbol-placement': 'line',
      'text-field': ['concat', ['to-string', ['get', 'ele']], 'm'],
      'text-font': ['Noto Sans Regular'],
      'text-size': 10,
      'text-pitch-alignment': 'auto',
    },
    paint: {
      'text-color': '#6b5c3e',
      'text-opacity': 0,
      'text-halo-color': 'rgba(255,255,255,0.8)',
      'text-halo-width': 1.5,
    },
  })
}

// ── Controlli visibilità overlay Waymarked ───────────────────────────────────

export function setOverlayVisibility(map, overlayId, visible) {
  if (!map.getLayer(overlayId)) return
  map.setLayoutProperty(overlayId, 'visibility', visible ? 'visible' : 'none')
}

// ── Controlli curve di livello ────────────────────────────────────────────────

// Lo slider va da 0 (invisibile) a 1 (piena opacità).
// Invece di visibility on/off usiamo opacity — così lo slider è l'unico controllo.
export function setContourOpacity(map, opacity) {
  if (map.getLayer('contours-minor')) {
    map.setPaintProperty('contours-minor', 'line-opacity', opacity * 0.7)
  }
  if (map.getLayer('contours-major')) {
    map.setPaintProperty('contours-major', 'line-opacity', opacity)
  }
  if (map.getLayer('contours-label')) {
    map.setPaintProperty('contours-label', 'text-opacity', opacity)
  }
}

// ── Controlli hillshade ───────────────────────────────────────────────────────

export function setHillshadeOpacity(map, opacity) {
  if (!map.getLayer('hillshade')) return
  map.setPaintProperty('hillshade', 'raster-opacity', opacity)
}

// ── Controllo layer basemap ───────────────────────────────────────────────────

export function setLayerGroupVisibility(map, layerIds, visible) {
  for (const id of layerIds) {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none')
    }
  }
}

export function getStyleLayerIds(map) {
  return map.getStyle().layers.map(l => ({ id: l.id, type: l.type }))
}

export function getFirstSymbolLayerId(map) {
  const layers = map.getStyle().layers
  for (const layer of layers) {
    if (layer.type === 'symbol') return layer.id
  }
  return undefined
}

// ── Terrain 3D ───────────────────────────────────────────────────────────────

function addTerrainSource(map) {
  // Sorgente DEM per il terrain 3D — formato terrarium (AWS pubblico)
  map.addSource('terrain-dem', {
    type: 'raster-dem',
    tiles: [TERRAIN_RGB_URL],
    tileSize: 256,
    maxzoom: 14,
    encoding: 'terrarium',
    attribution: 'Terrain © <a href="https://aws.amazon.com">AWS</a>',
  })
}

export function setTerrain3D(map, enabled, exaggeration = 1.5) {
  if (enabled) {
    map.setTerrain({ source: 'terrain-dem', exaggeration })
    // Inclina automaticamente la mappa per mostrare il 3D
    map.easeTo({ pitch: 50, duration: 800 })
  } else {
    map.setTerrain(null)
    // Riporta la mappa in vista dall'alto
    map.easeTo({ pitch: 0, duration: 800 })
  }
}

export function setTerrainExaggeration(map, exaggeration) {
  if (map.getTerrain()) {
    map.setTerrain({ source: 'terrain-dem', exaggeration })
  }
}
