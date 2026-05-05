/**
 * components/search.js
 * Ricerca luoghi via Nominatim (OSM) con throttling e cache locale.
 */

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'
const MIN_QUERY_LENGTH = 3
const DEBOUNCE_MS = 600       // Aspetta 600ms dopo l'ultima digitazione
const RATE_LIMIT_MS = 1100    // Minimo 1.1s tra una richiesta e l'altra

let lastRequestTime = 0
let debounceTimer = null
const cache = new Map()

export function initSearch(map) {
  const input = document.getElementById('search-input')
  const results = document.getElementById('search-results')

  if (!input || !results) return

  input.addEventListener('input', () => {
    clearTimeout(debounceTimer)
    const query = input.value.trim()

    if (query.length < MIN_QUERY_LENGTH) {
      hideResults(results)
      return
    }

    debounceTimer = setTimeout(() => search(query, map, results), DEBOUNCE_MS)
  })

  // Chiudi risultati cliccando fuori
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#search-bar')) hideResults(results)
  })

  // ESC chiude
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      hideResults(results)
      input.blur()
    }
  })
}

async function search(query, map, resultsEl) {
  // Cache hit
  if (cache.has(query)) {
    renderResults(cache.get(query), query, map, resultsEl)
    return
  }

  // Rate limiting
  const now = Date.now()
  const elapsed = now - lastRequestTime
  if (elapsed < RATE_LIMIT_MS) {
    await sleep(RATE_LIMIT_MS - elapsed)
  }

  try {
    lastRequestTime = Date.now()
    const url = new URL(NOMINATIM_URL)
    url.searchParams.set('q', query)
    url.searchParams.set('format', 'json')
    url.searchParams.set('limit', '5')
    url.searchParams.set('addressdetails', '0')
    // Biased verso l'Europa
    url.searchParams.set('viewbox', '-10,70,30,35')
    url.searchParams.set('bounded', '0')

    const res = await fetch(url, {
      headers: { 'Accept-Language': 'it,en', 'User-Agent': 'mappa-esplorativa-familiare/1.0' },
    })
    const data = await res.json()
    cache.set(query, data)
    renderResults(data, query, map, resultsEl)
  } catch (err) {
    console.warn('Nominatim error:', err)
  }
}

function renderResults(data, query, map, resultsEl) {
  if (!data.length) {
    resultsEl.innerHTML = `<div class="search-no-results">Nessun risultato per "${query}"</div>`
    resultsEl.classList.remove('hidden')
    return
  }

  resultsEl.innerHTML = data
    .map(
      (item) => `
      <button class="search-result-item" data-lat="${item.lat}" data-lon="${item.lon}">
        <span class="search-result-name">${item.display_name.split(',').slice(0, 2).join(', ')}</span>
        <span class="search-result-type">${item.type}</span>
      </button>
    `
    )
    .join('')

  resultsEl.classList.remove('hidden')

  // Click su risultato → vola lì
  resultsEl.querySelectorAll('.search-result-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      const lat = parseFloat(btn.dataset.lat)
      const lon = parseFloat(btn.dataset.lon)
      map.flyTo({ center: [lon, lat], zoom: 13, duration: 1200 })
      hideResults(resultsEl)
      document.getElementById('search-input').value = btn.querySelector('.search-result-name').textContent
    })
  })
}

function hideResults(el) {
  el.classList.add('hidden')
  el.innerHTML = ''
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
