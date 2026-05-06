/**
 * components/secrets.js
 * Segreti OSM — punti di interesse nascosti ed esplorativi.
 * Sorgente: PMTiles pre-generato da script Python (copertura Europa)
 * Fallback: GeoJSON demo con qualche punto di test
 */

import maplibregl from 'maplibre-gl'

// ── Categorie complete ────────────────────────────────────────────────────────

export const CATEGORIES = {
  // Storia e archeologia
  castle:      { label: 'Castelli e fortezze',     emoji: '🏰', color: '#C0392B', group: 'storia' },
  ruins:       { label: 'Rovine e ruderi',          emoji: '🏚️', color: '#8B6F47', group: 'storia' },
  archaeology: { label: 'Siti archeologici',        emoji: '🏛️', color: '#A0522D', group: 'storia' },
  monument:    { label: 'Monumenti storici',        emoji: '🗿', color: '#7D6608', group: 'storia' },
  battlefield: { label: 'Campi di battaglia',       emoji: '⚔️', color: '#922B21', group: 'storia' },
  monastery:   { label: 'Monasteri e abbazie',      emoji: '⛪', color: '#7D3C98', group: 'storia' },
  wayside:     { label: 'Croci e tabernacoli',      emoji: '✝️', color: '#9B59B6', group: 'storia' },

  // Natura
  cave:        { label: 'Grotte e caverne',         emoji: '🕳️', color: '#5B4B8A', group: 'natura' },
  peak:        { label: 'Vette e cime',             emoji: '⛰️', color: '#2471A3', group: 'natura' },
  viewpoint:   { label: 'Punti panoramici',         emoji: '🔭', color: '#1A8C6E', group: 'natura' },
  spring:      { label: 'Sorgenti e fontanelle',    emoji: '💧', color: '#17A589', group: 'natura' },
  waterfall:   { label: 'Cascate',                  emoji: '🌊', color: '#1F618D', group: 'natura' },
  volcano:     { label: 'Vulcani e geologia',       emoji: '🌋', color: '#D35400', group: 'natura' },
  tree:        { label: 'Alberi monumentali',       emoji: '🌳', color: '#1E8449', group: 'natura' },
  beach:       { label: 'Spiagge e laghi balneabili', emoji: '🏖️', color: '#F39C12', group: 'natura' },

  // Esplorazione
  mine:        { label: 'Miniere e cave',           emoji: '⛏️', color: '#616A6B', group: 'urbex' },
  bunker:      { label: 'Bunker e siti militari',   emoji: '🪖', color: '#4D5656', group: 'urbex' },
  industrial:  { label: 'Siti industriali dismessi',emoji: '🏭', color: '#717D7E', group: 'urbex' },
  abandoned_rail: { label: 'Ferrovie abbandonate',  emoji: '🛤️', color: '#784212', group: 'urbex' },
  ghost_station:  { label: 'Stazioni fantasma',     emoji: '🚉', color: '#6E2F19', group: 'urbex' },
  wreck:       { label: 'Relitti',                  emoji: '🛩️', color: '#2C3E50', group: 'urbex' },

  // Rifugi e punti tappa
  alpine_hut:  { label: 'Rifugi e bivacchi',        emoji: '🛖', color: '#E67E22', group: 'tappa' },
  artwork:     { label: 'Arte pubblica',             emoji: '🎨', color: '#8E44AD', group: 'tappa' },
}

// Gruppi per organizzare i filtri nel pannello
export const CATEGORY_GROUPS = {
  storia: { label: 'Storia',       emoji: '🏛️' },
  natura: { label: 'Natura',       emoji: '🌿' },
  urbex:  { label: 'Esplorazione', emoji: '🔦' },
  tappa:  { label: 'Tappa',        emoji: '🛖' },
}

// Categorie attive di default (tutte)
const activeCategories = new Set(Object.keys(CATEGORIES))

// ── Inizializzazione ──────────────────────────────────────────────────────────

export async function initSecrets(map) {
  console.info('Segreti: usando GeoJSON')
  await initWithGeoJSON(map)
}

function initWithTiles(map, basePath = '') {
  const tileBase = window.location.hostname === 'localhost'
    ? 'http://localhost:5174'
    : window.location.origin + basePath

  map.addSource('secrets', {
    type: 'vector',
    tiles: [`${tileBase}/tiles/secrets/{z}/{x}/{y}.pbf`],
    minzoom: 4,
    maxzoom: 12,
    attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
  })

  addSecretsLayers(map, 'vector')
  setupInteractions(map)
  buildFilterUI(map)
}

async function initWithGeoJSON(map) {
  let geojson
  const geojsonPath = '/geojson/secrets.geojson'
  try {
    const res = await fetch(geojsonPath)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    geojson = await res.json()
    console.info(`Segreti caricati: ${geojson.features.length} punti`)
  } catch (err) {
    console.warn('secrets.geojson non trovato — usando dati demo')
    geojson = DEMO_GEOJSON
  }

  map.addSource('secrets', {
    type: 'geojson',
    data: geojson,
    cluster: true,
    clusterMaxZoom: 12,
    clusterRadius: 40,
  })

  addSecretsLayers(map, 'geojson')
  setupInteractions(map)
  buildFilterUI(map)
}

// ── Layer ─────────────────────────────────────────────────────────────────────

function addSecretsLayers(map, sourceType) {
  const sourceLayer = sourceType === 'vector' ? { 'source-layer': 'secrets' } : {}

  // Con tile vettoriali tippecanoe i cluster sono già nelle tile
  // Cluster — cerchio con numero (tippecanoe usa clustered=true)
  map.addLayer({
    id: 'secrets-clusters',
    type: 'circle',
    source: 'secrets',
    ...sourceLayer,
    filter: ['==', ['get', 'clustered'], true],
    minzoom: 4,
    paint: {
      'circle-color': '#ffffff',
      'circle-radius': 16,
      'circle-stroke-width': 2,
      'circle-stroke-color': '#555',
      'circle-opacity': 0.92,
    },
  })

  // Numero nel cluster
  map.addLayer({
    id: 'secrets-cluster-count',
    type: 'symbol',
    source: 'secrets',
    ...sourceLayer,
    filter: ['==', ['get', 'clustered'], true],
    minzoom: 4,
    layout: {
      'text-field': ['to-string', ['get', 'point_count']],
      'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
      'text-size': 11,
    },
    paint: { 'text-color': '#333' },
  })

  // Punti singoli
  map.addLayer({
    id: 'secrets-points',
    type: 'symbol',
    source: 'secrets',
    ...sourceLayer,
    filter: ['!=', ['get', 'clustered'], true],
    minzoom: 4,
    layout: {
      'text-field': buildEmojiExpression(),
      'text-size': 20,
      'text-allow-overlap': false,
      'text-padding': 4,
    },
    paint: {
      'text-opacity': 1,
    },
  })
}

// Espressione MapLibre per selezionare l'emoji giusta per categoria
function buildEmojiExpression() {
  const expr = ['match', ['get', 'category']]
  for (const [key, cat] of Object.entries(CATEGORIES)) {
    expr.push(key, cat.emoji)
  }
  expr.push('📍') // fallback
  return expr
}

// ── Interazioni ───────────────────────────────────────────────────────────────

function setupInteractions(map) {
  // Click cluster → zoom in
  map.on('click', 'secrets-clusters', (e) => {
    const features = map.queryRenderedFeatures(e.point, { layers: ['secrets-clusters'] })
    const clusterId = features[0].properties.cluster_id
    map.getSource('secrets').getClusterExpansionZoom(clusterId, (err, zoom) => {
      if (err) return
      map.easeTo({ center: features[0].geometry.coordinates, zoom: zoom + 1, duration: 400 })
    })
  })

  // Click punto → popup
  map.on('click', 'secrets-points', (e) => {
    const feature = e.features[0]
    // Clona le coordinate per evitare problemi con anti-meridiano
    const coords = [...feature.geometry.coordinates]
    showPopup(feature, coords, map)
  })

  // Click mappa fuori dai punti → chiudi popup
  map.on('click', (e) => {
    const hits = map.queryRenderedFeatures(e.point, {
      layers: ['secrets-points', 'secrets-clusters'],
    })
    if (!hits.length) closePopup()
  })

  // Cursore
  map.on('mouseenter', 'secrets-points', () => { map.getCanvas().style.cursor = 'pointer' })
  map.on('mouseleave', 'secrets-points', () => { map.getCanvas().style.cursor = '' })
  map.on('mouseenter', 'secrets-clusters', () => { map.getCanvas().style.cursor = 'pointer' })
  map.on('mouseleave', 'secrets-clusters', () => { map.getCanvas().style.cursor = '' })

  // Pulsante X popup
  document.getElementById('popup-close')?.addEventListener('click', closePopup)
}

// ── Popup ─────────────────────────────────────────────────────────────────────

function closePopup() {
  document.getElementById('secret-popup')?.classList.add('hidden')
}

function showPopup(feature, coords, map) {
  const props   = feature.properties
  const catKey  = props.category
  const cat     = CATEGORIES[catKey] || { emoji: '📍', label: catKey, color: '#888' }

  const popup   = document.getElementById('secret-popup')
  const content = document.getElementById('popup-content')
  if (!popup || !content) return

  // Wikipedia link se disponibile
  const wikiLink = props.wikipedia
    ? `<a class="popup-wiki-link" href="https://it.wikipedia.org/wiki/${encodeURIComponent(props.wikipedia.replace('it:', ''))}" target="_blank" rel="noopener">Wikipedia →</a>`
    : ''

  content.innerHTML = `
    <div class="popup-category" style="color:${cat.color}">${cat.emoji} ${cat.label}</div>
    <h3 class="popup-name">${props.name || 'Senza nome'}</h3>
    ${props.ele ? `<div class="popup-meta">⛰️ ${props.ele} m s.l.m.</div>` : ''}
    ${props.description ? `<p class="popup-desc">${props.description}</p>` : ''}
    <div class="popup-links">
      <a class="popup-osm-link" href="${props.osm_url}" target="_blank" rel="noopener">OpenStreetMap →</a>
      ${wikiLink}
    </div>
  `

  popup.classList.remove('hidden')
}

// ── Filtri ────────────────────────────────────────────────────────────────────

function buildFilterUI(map) {
  const container = document.getElementById('secrets-filters')
  if (!container) return
  container.innerHTML = ''

  // Raggruppa per gruppo
  for (const [groupKey, group] of Object.entries(CATEGORY_GROUPS)) {
    const groupEl = document.createElement('div')
    groupEl.className = 'filter-group'

    const groupHeader = document.createElement('div')
    groupHeader.className = 'filter-group-header'
    groupHeader.textContent = `${group.emoji} ${group.label}`
    groupEl.appendChild(groupHeader)

    const catsInGroup = Object.entries(CATEGORIES).filter(([, c]) => c.group === groupKey)

    for (const [key, cat] of catsInGroup) {
      const row = document.createElement('div')
      row.className = 'legend-row legend-row--secret'

      const dot = document.createElement('span')
      dot.className = 'legend-dot legend-dot--on'
      dot.style.background = cat.color

      const emojiEl = document.createElement('span')
      emojiEl.className = 'legend-emoji'
      emojiEl.textContent = cat.emoji

      const lbl = document.createElement('span')
      lbl.className = 'legend-label'
      lbl.textContent = cat.label

      row.appendChild(dot)
      row.appendChild(emojiEl)
      row.appendChild(lbl)

      let active = true
      row.addEventListener('click', () => {
        active = !active
        if (active) {
          activeCategories.add(key)
          dot.classList.add('legend-dot--on')
          dot.style.background = cat.color
        } else {
          activeCategories.delete(key)
          dot.classList.remove('legend-dot--on')
          dot.style.background = '#ccc'
        }
        row.classList.toggle('legend-row--off', !active)
        applyFilter(map)
      })

      groupEl.appendChild(row)
    }

    container.appendChild(groupEl)
  }
}

function applyFilter(map) {
  if (!map.getLayer('secrets-points')) return
  const active = [...activeCategories]
  if (active.length === 0) {
    map.setFilter('secrets-points', ['==', 'category', '__none__'])
  } else {
    map.setFilter('secrets-points', ['in', ['get', 'category'], ['literal', active]])
  }
}

// ── Demo fallback ─────────────────────────────────────────────────────────────

const DEMO_GEOJSON = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [10.1833, 45.5416] },
      properties: { id: 'demo/1', name: 'Castello di Brescia', category: 'castle',
        osm_url: 'https://www.openstreetmap.org/way/38209726', ele: '248',
        description: 'Domina la città dall\'alto del Cidneo.' },
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [10.4, 45.9] },
      properties: { id: 'demo/2', name: 'Grotta di Covolo', category: 'cave',
        osm_url: 'https://www.openstreetmap.org',
        description: 'Grotta carsica con concrezioni notevoli.' },
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [10.05, 45.7] },
      properties: { id: 'demo/3', name: 'Monte Maddalena', category: 'viewpoint',
        osm_url: 'https://www.openstreetmap.org', ele: '874',
        description: 'Panorama a 360° sulla pianura padana e le Alpi.' },
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [10.3, 46.1] },
      properties: { id: 'demo/4', name: 'Miniera di Valle Camonica', category: 'mine',
        osm_url: 'https://www.openstreetmap.org',
        description: 'Antica miniera di ferro abbandonata.' },
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [9.9, 45.8] },
      properties: { id: 'demo/5', name: 'Cascata del Serio', category: 'waterfall',
        osm_url: 'https://www.openstreetmap.org', ele: '1850',
        description: 'Una delle cascate più alte d\'Europa.' },
    },
  ],
}
