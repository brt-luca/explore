/**
 * tile-server.js
 * Server Express leggero per servire le tile .pbf con il Content-Type corretto.
 * Gira in parallelo a Vite su porta 5174.
 *
 * Avvio: node tile-server.js
 */

import express from 'express'
import { existsSync, readFileSync } from 'fs'
import { join, resolve } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app  = express()
const PORT = 5174
const TILES_DIR = resolve(__dirname, 'public/tiles')

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  next()
})

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

app.listen(PORT, () => {
  console.log(`🗺️  Tile server attivo su http://localhost:${PORT}`)
})
