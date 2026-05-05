/**
 * components/panel.js
 * Legenda dinamica con classificazione esatta dei layer Liberty (OpenFreeMap).
 * Layer IDs verificati direttamente dallo stile caricato nel browser.
 */

import { setHillshadeOpacity, setLayerGroupVisibility, setOverlayVisibility, setContourOpacity, getStyleLayerIds, WAYMARKED_OVERLAYS, setTerrain3D, setTerrainExaggeration } from './map.js'
import { setRainVisibility, setRainOpacity, playRainAnimation, stepRainFrame, setProtectedAreasVisibility, setProtectedAreasOpacity, setFirmsVisibility } from './overlays.js'

const EXCLUDE = new Set([
  'hillshade',
  'building-3d',  // rimosso — non necessario
  'secrets-clusters', 'secrets-cluster-count', 'secrets-points',
  'wmt-hiking', 'wmt-cycling', 'wmt-mtb', 'wmt-slopes',
  'contours-minor', 'contours-major', 'contours-label',
  'protected-areas-fill', 'protected-areas-names',
  'firms',
])

// Classificazione esatta — ogni array contiene i nomi reali dei layer Liberty.
// I layer casing/hatching sono raggruppati con la categoria principale
// perché non ha senso controllarli separatamente.
const LAYER_CATEGORIES = [
  {
    id: 'background',
    label: 'Sfondo',
    emoji: '🌍',
    default: true,
    ids: [
      'background',
      'natural_earth',
      'landcover_sand',
      'landcover_ice',
      'landcover_wetland',
      'road_area_pattern',
    ],
  },
  {
    id: 'water',
    label: 'Acqua',
    emoji: '💧',
    default: true,
    ids: [
      'water',
      'waterway_river',
      'waterway_other',
      'waterway_tunnel',
    ],
  },
  {
    id: 'forest',
    label: 'Boschi e foreste',
    emoji: '🌲',
    default: true,
    ids: ['landcover_wood'],
  },
  {
    id: 'grass',
    label: 'Prati e pascoli',
    emoji: '🌿',
    default: true,
    ids: ['landcover_grass'],
  },
  {
    id: 'park',
    label: 'Parchi urbani',
    emoji: '🏞️',
    default: true,
    ids: ['park', 'park_outline'],
  },
  {
    id: 'wetland',
    label: 'Zone umide',
    emoji: '🌾',
    default: true,
    ids: ['landcover_wetland'],
  },
  {
    id: 'sand_ice',
    label: 'Spiagge e ghiacciai',
    emoji: '🏔️',
    default: true,
    ids: ['landcover_sand', 'landcover_ice'],
  },
  {
    id: 'urban',
    label: 'Zone urbane',
    emoji: '🏘️',
    default: true,
    ids: ['landuse_residential', 'landuse_pitch', 'landuse_track', 'landuse_cemetery', 'landuse_hospital', 'landuse_school'],
  },
  {
    id: 'building',
    label: 'Edifici',
    emoji: '🏠',
    default: true,
    ids: ['building'],
  },
  {
    id: 'road_motorway',
    label: 'Autostrade',
    emoji: '🛣️',
    default: true,
    ids: [
      'road_motorway',
      'road_motorway_casing',
      'road_motorway_link',
      'road_motorway_link_casing',
    ],
  },
  {
    id: 'road_main',
    label: 'Strade principali',
    emoji: '🚗',
    default: true,
    ids: [
      'road_trunk_primary',
      'road_trunk_primary_casing',
      'road_secondary_tertiary',
      'road_secondary_tertiary_casing',
      'road_link',
      'road_link_casing',
      'road_one_way_arrow',
      'road_one_way_arrow_opposite',
    ],
  },
  {
    id: 'road_local',
    label: 'Strade locali',
    emoji: '🏙️',
    default: true,
    ids: [
      'road_minor',
      'road_minor_casing',
      'road_service_track',
      'road_service_track_casing',
    ],
  },
  {
    id: 'path',
    label: 'Sentieri e percorsi',
    emoji: '🥾',
    default: true,
    ids: [
      'road_path_pedestrian',
      'tunnel_path_pedestrian',
      'bridge_path_pedestrian',
      'bridge_path_pedestrian_casing',
      'highway-name-path',
    ],
  },
  {
    id: 'tunnel',
    label: 'Tunnel',
    emoji: '🚇',
    default: true,
    ids: [
      'tunnel_motorway',
      'tunnel_motorway_casing',
      'tunnel_motorway_link',
      'tunnel_motorway_link_casing',
      'tunnel_trunk_primary',
      'tunnel_trunk_primary_casing',
      'tunnel_secondary_tertiary',
      'tunnel_secondary_tertiary_casing',
      'tunnel_minor',
      'tunnel_link',
      'tunnel_link_casing',
      'tunnel_service_track',
      'tunnel_service_track_casing',
      'tunnel_street_casing',
    ],
  },
  {
    id: 'bridge',
    label: 'Ponti e viadotti',
    emoji: '🌉',
    default: true,
    ids: [
      'bridge_motorway',
      'bridge_motorway_casing',
      'bridge_motorway_link',
      'bridge_trunk_primary',
      'bridge_trunk_primary_casing',
      'bridge_secondary_tertiary',
      'bridge_secondary_tertiary_casing',
      'bridge_street',
      'bridge_street_casing',
      'bridge_link',
      'bridge_link_casing',
      'bridge_service_track',
      'bridge_service_track_casing',
    ],
  },
  {
    id: 'railway',
    label: 'Ferrovie',
    emoji: '🚂',
    default: true,
    ids: [
      'road_major_rail',
      'road_major_rail_hatching',
      'tunnel_major_rail',
      'tunnel_major_rail_hatching',
      'bridge_major_rail',
      'bridge_major_rail_hatching',
    ],
  },
  {
    id: 'transit_rail',
    label: 'Metro e tram',
    emoji: '🚋',
    default: true,
    ids: [
      'road_transit_rail',
      'road_transit_rail_hatching',
      'tunnel_transit_rail',
      'tunnel_transit_rail_hatching',
      'bridge_transit_rail',
      'bridge_transit_rail_hatching',
    ],
  },
  {
    id: 'aeroway',
    label: 'Aeroporti',
    emoji: '✈️',
    default: true,
    ids: ['aeroway_fill', 'aeroway_runway', 'aeroway_taxiway', 'airport'],
  },
  {
    id: 'boundary',
    label: 'Confini',
    emoji: '🗺️',
    default: true,
    ids: ['boundary_2', 'boundary_3', 'boundary_disputed'],
  },
  {
    id: 'poi_transit',
    label: 'Fermate mezzi pubblici',
    emoji: '🚌',
    default: false,
    ids: ['poi_transit'],
  },
  {
    id: 'poi',
    label: 'Punti di interesse',
    emoji: '📍',
    default: false,
    ids: ['poi_r1', 'poi_r7', 'poi_r20'],
  },
  {
    id: 'label_place',
    label: 'Nomi città e paesi',
    emoji: '🏙️',
    default: true,
    ids: [
      'label_village',
      'label_town',
      'label_city',
      'label_city_capital',
      'label_state',
      'label_country_1',
      'label_country_2',
      'label_country_3',
    ],
  },
  {
    id: 'label_road',
    label: 'Nomi strade',
    emoji: '🔤',
    default: true,
    ids: [
      'highway-name-minor',
      'highway-name-major',
      'highway-shield-non-us',
      'highway-shield-us-interstate',
      'road_shield_us',
    ],
  },
  {
    id: 'label_water',
    label: 'Nomi acque',
    emoji: '🌊',
    default: true,
    ids: ['waterway_line_label', 'water_name_point_label', 'water_name_line_label'],
  },
  {
    id: 'label_other',
    label: 'Altre etichette',
    emoji: '🏷️',
    default: true,
    ids: ['label_other'],
  },
]

const CATEGORY_OTHER = { id: 'other', label: 'Altro', emoji: '◻️', default: true }

const categoryState = {}

export function initPanel(map) {
  const panel = document.getElementById('layer-panel')
  const toggleBtn = document.getElementById('panel-toggle')
  const icon = toggleBtn?.querySelector('.panel-toggle-icon')

  toggleBtn?.addEventListener('click', () => {
    const isOpen = panel.classList.toggle('open')
    if (icon) icon.textContent = isOpen ? '▶' : '◀'
  })

  if (window.innerWidth <= 768) {
    panel.classList.remove('open')
  } else {
    panel.classList.add('open')
  }

  document.getElementById('slider-hillshade')?.addEventListener('input', (e) => {
    setHillshadeOpacity(map, parseFloat(e.target.value))
  })

  // ── Terrain 3D ───────────────────────────────────────────────────────────
  document.getElementById('toggle-terrain3d')?.addEventListener('change', (e) => {
    const exaggeration = parseFloat(document.getElementById('slider-terrain3d')?.value || 1.5)
    setTerrain3D(map, e.target.checked, exaggeration)
  })
  document.getElementById('slider-terrain3d')?.addEventListener('input', (e) => {
    setTerrainExaggeration(map, parseFloat(e.target.value))
  })

  // ── Percorsi Waymarked — ogni overlay separato ──────────────────────────
  initWaymarkedPanel(map)

  // ── Curve di livello — slider opacità (0 = nascoste) ───────────────────
  const sliderContours = document.getElementById('slider-contours')
  if (sliderContours) {
    sliderContours.addEventListener('input', (e) => {
      setContourOpacity(map, parseFloat(e.target.value))
    })
  }

  // ── Radar pioggia ────────────────────────────────────────────────────────
  document.getElementById('toggle-rain')?.addEventListener('change', (e) => {
    setRainVisibility(map, e.target.checked)
  })
  document.getElementById('slider-rain')?.addEventListener('input', (e) => {
    setRainOpacity(map, parseFloat(e.target.value))
  })
  document.getElementById('btn-rain-play')?.addEventListener('click', () => {
    playRainAnimation(map)
  })
  document.getElementById('btn-rain-prev')?.addEventListener('click', () => {
    stepRainFrame(map, -1)
  })
  document.getElementById('btn-rain-next')?.addEventListener('click', () => {
    stepRainFrame(map, +1)
  })

  // ── Aree protette ────────────────────────────────────────────────────────
  document.getElementById('toggle-protected')?.addEventListener('change', (e) => {
    setProtectedAreasVisibility(map, e.target.checked)
  })
  document.getElementById('slider-protected')?.addEventListener('input', (e) => {
    setProtectedAreasOpacity(map, parseFloat(e.target.value))
  })

  // ── Incendi NASA FIRMS ───────────────────────────────────────────────────
  document.getElementById('toggle-firms')?.addEventListener('change', (e) => {
    setFirmsVisibility(map, e.target.checked)
  })

  // Costruisce la legenda dopo che tutto è caricato
  // Usa 'idle' con timeout fallback per evitare blocchi
  let legendBuilt = false
  const tryBuildLegend = () => {
    if (legendBuilt) return
    legendBuilt = true
    buildLegend(map)
  }

  if (map.isStyleLoaded()) {
    setTimeout(tryBuildLegend, 100)
  } else {
    map.once('load', () => setTimeout(tryBuildLegend, 100))
  }
  // Fallback: se dopo 3 secondi non è ancora costruita, riprova
  setTimeout(tryBuildLegend, 3000)
}

function buildLegend(map) {
  const container = document.getElementById('basemap-legend')
  if (!container) return

  try {
    // Raccoglie tutti gli ID layer presenti nello stile (esclude i nostri custom)
    const presentIds = new Set(
      getStyleLayerIds(map)
        .map(l => l.id)
        .filter(id => !EXCLUDE.has(id) && !id.startsWith('rain-'))
    )

    const assigned = new Set()
    container.innerHTML = ''

    for (const cat of LAYER_CATEGORIES) {
      const layerIds = cat.ids.filter(id => presentIds.has(id))
      if (layerIds.length === 0) continue

      layerIds.forEach(id => assigned.add(id))
      categoryState[cat.id] = { visible: cat.default !== false, layerIds }

      if (!cat.default) {
        setLayerGroupVisibility(map, layerIds, false)
      }

      container.appendChild(buildCategoryRow(map, cat.id, cat.label, cat.emoji, cat.default, layerIds))
    }

    // Catch-all
    const unassigned = [...presentIds].filter(id => !assigned.has(id))
    if (unassigned.length) {
      categoryState['other'] = { visible: true, layerIds: unassigned }
      container.appendChild(buildCategoryRow(map, 'other', CATEGORY_OTHER.label, CATEGORY_OTHER.emoji, true, unassigned))
    }

    if (container.children.length === 0) {
      container.innerHTML = '<div class="legend-loading">Nessun layer trovato</div>'
    }
  } catch (err) {
    console.error('buildLegend error:', err)
    container.innerHTML = '<div class="legend-loading">Errore caricamento layer</div>'
    // Riprova dopo 1 secondo
    setTimeout(() => buildLegend(map), 1000)
  }
}

function buildCategoryRow(map, catId, label, emoji, defaultOn, layerIds) {
  const isOn = defaultOn !== false

  const row = document.createElement('div')
  row.className = 'legend-row' + (isOn ? '' : ' legend-row--off')

  const dot = document.createElement('span')
  dot.className = 'legend-dot' + (isOn ? ' legend-dot--on' : '')

  const emojiEl = document.createElement('span')
  emojiEl.className = 'legend-emoji'
  emojiEl.textContent = emoji

  const lbl = document.createElement('span')
  lbl.className = 'legend-label'
  lbl.textContent = label

  row.appendChild(dot)
  row.appendChild(emojiEl)
  row.appendChild(lbl)

  row.addEventListener('click', () => {
    const state = categoryState[catId]
    state.visible = !state.visible
    setLayerGroupVisibility(map, state.layerIds, state.visible)
    row.classList.toggle('legend-row--off', !state.visible)
    dot.classList.toggle('legend-dot--on', state.visible)
  })

  return row
}

// ── Percorsi Waymarked — ogni overlay ha la sua riga separata ────────────────

function initWaymarkedPanel(map) {
  const container = document.getElementById('waymarked-legend')
  if (!container) return

  for (const overlay of WAYMARKED_OVERLAYS) {
    const isOn = overlay.default

    const row = document.createElement('div')
    row.className = 'legend-row' + (isOn ? '' : ' legend-row--off')

    const dot = document.createElement('span')
    dot.className = 'legend-dot' + (isOn ? ' legend-dot--on' : '')

    const emojiEl = document.createElement('span')
    emojiEl.className = 'legend-emoji'
    emojiEl.textContent = overlay.emoji

    const lbl = document.createElement('span')
    lbl.className = 'legend-label'
    lbl.textContent = overlay.label

    row.appendChild(dot)
    row.appendChild(emojiEl)
    row.appendChild(lbl)

    let visible = isOn
    row.addEventListener('click', () => {
      visible = !visible
      setOverlayVisibility(map, overlay.id, visible)
      row.classList.toggle('legend-row--off', !visible)
      dot.classList.toggle('legend-dot--on', visible)
    })

    container.appendChild(row)
  }
}

