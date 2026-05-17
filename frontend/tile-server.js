/**
 * tile-server.js
 * Server Express per:
 * 1. Servire tile .pbf dei segreti con Content-Type corretto
 * 2. Fare da proxy per Strava heatmap (aggiunge cookie di sessione)
 *
 * Avvio: node tile-server.js
 */

import express from 'express'
import { existsSync, readFileSync } from 'fs'
import { join, resolve } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app      = express()
const PORT     = 5174
const TILES_DIR = resolve(__dirname, 'public/tiles')

// Cookie Strava — aggiornalo quando scade
const STRAVA_COOKIE = '_currentH=d3d3LnN0cmF2YS5jb20=; _strava4_session=da22bi574g4b5t9t1i2t61i9rlg65f4c; CookieConsent={stamp:%27F0gDVnZTs3L066FmCHTs1YLvuaJtcDl5ox1FxIBf/cF+Q1Py1ObbtQ==%27%2Cnecessary:true%2Cpreferences:false%2Cstatistics:false%2Cmarketing:false%2Cmethod:%27explicit%27%2Cver:2%2Cutc:1777322931594%2Cregion:%27it%27}; globalHeatmapAboutModal=true; xp_session_identifier=p933wgm4pia; _strava_CloudFront-Expires=1778713379000'

const STRAVA_COLOR = 'hot'  // hot, blue, purple, gray, bluered

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  next()
})

// ── Tile segreti ──────────────────────────────────────────────────────────────
app.get('/tiles/:layer/:z/:x/:y.pbf', (req, res) => {
  const { layer, z, x, y } = req.params
  const filePath = join(TILES_DIR, layer, z, x, `${y}.pbf`)

  if (!existsSync(filePath)) {
    return res.status(204).send()
  }

  const data = readFileSync(filePath)
  res.setHeader('Content-Type', 'application/x-protobuf')
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')
  res.setHeader('Pragma', 'no-cache')
  res.setHeader('ETag', Math.random().toString())
  res.send(data)
})

// ── Proxy Strava heatmap ──────────────────────────────────────────────────────
app.get('/strava/:z/:x/:y', async (req, res) => {
  const { z, x, y } = req.params
  const url = `https://heatmap-external-a.strava.com/tiles-auth/all/${STRAVA_COLOR}/${z}/${x}/${y}.png?v=19`

  try {
    const response = await fetch(url, {
      headers: {
        'Cookie': STRAVA_COOKIE,
        'User-Agent': 'Mozilla/5.0',
        'Referer': 'https://www.strava.com/heatmap',
      },
    })

    if (!response.ok) {
      console.warn(`Strava tile ${z}/${x}/${y}: ${response.status}`)
      return res.status(response.status).send()
    }

    const buffer = await response.arrayBuffer()
    res.setHeader('Content-Type', 'image/png')
    res.setHeader('Cache-Control', 'public, max-age=3600')
    res.send(Buffer.from(buffer))
  } catch (err) {
    console.error('Strava proxy error:', err.message)
    res.status(500).send()
  }
})

app.listen(PORT, () => {
  console.log(`🗺️  Tile server attivo su http://localhost:${PORT}`)
  console.log(`   Segreti: http://localhost:${PORT}/tiles/secrets/{z}/{x}/{y}.pbf`)
  console.log(`   Strava:  http://localhost:${PORT}/strava/{z}/{x}/{y}`)
})
