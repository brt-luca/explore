# Note tecniche e decisioni architetturali

## Perché MapLibre GL JS

MapLibre è il fork open source di Mapbox GL JS, completamente gratuito e
senza limiti di utilizzo. Supporta stili vettoriali JSON, layer raster,
GeoJSON, PMTiles, hillshade nativo. È la scelta naturale per questo progetto.

## Perché OpenFreeMap

Fornisce tile vettoriali OSM globali, gratuite, senza registrazione né API key.
Stili disponibili: Positron, Bright, Liberty. Per l'MVP si parte da Liberty
(più ricco visivamente) e si raffina con modifiche minime allo stile JSON.

URL tile: `https://tiles.openfreemap.org/styles/liberty`

## Perché Vite come bundler

Zero configurazione per iniziare, hot reload immediato, build ottimizzata per
produzione. Alternativa considerata: nessun bundler (HTML puro con import maps).
Vite vince per la comodità dello sviluppo.

## Pipeline hillshade

1. Download DEM: SRTM 30m via USGS EarthExplorer o OpenTopography API
2. Proiezione e ritaglio area di interesse con GDAL
3. Generazione hillshade con `gdaldem hillshade`
4. Tiling con `gdal2tiles` o `rio-cogeo` → directory z/x/y.png
5. Upload statico su GitHub Pages sotto `frontend/public/hillshade/`

Per l'MVP: area Italia settentrionale (bbox: 6.5,43.5,14.0,47.5)

## Pipeline segreti OSM

Query Overpass per categorie:
- `historic=castle` → Castelli
- `historic=ruins` → Rovine
- `natural=cave_entrance` → Grotte
- `tourism=viewpoint` → Panoramici
- `amenity=drinking_water` + `natural=spring` → Sorgenti

Output: un GeoJSON per categoria, poi merge in `secrets.geojson` con
proprietà `category`, `name`, `osm_id`, `osm_url`.

Dimensione stimata per l'area MVP: ~2-5 MB totali, gestibile come statico.

## Gestione API key

L'architettura non richiede nessuna API key per l'MVP. Se in futuro si
integrano servizi opzionali (es. Mapbox fallback, Sentinel Hub), le key
vanno in un file `.env` mai committato, con fallback graceful se assenti.

## localStorage schema

```json
{
  "map_state": {
    "center": [lng, lat],
    "zoom": 10,
    "active_layers": ["hillshade", "secrets"],
    "labels_visible": true
  },
  "custom_secrets": [...],
  "saved_views": [...]
}
```

## Struttura GeoJSON segreti

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [lng, lat] },
      "properties": {
        "id": "osm_123456",
        "name": "Castello di Brescia",
        "category": "castle",
        "osm_url": "https://www.openstreetmap.org/node/123456",
        "description": "..."
      }
    }
  ]
}
```

## Decisioni prese e motivazioni

| Decisione | Alternativa scartata | Motivo |
|-----------|---------------------|--------|
| OpenFreeMap | MapTiler free tier | OpenFreeMap: no key, no limiti |
| Vite | webpack, parcel | Semplicità configurazione |
| GeoJSON statico | Overpass a runtime | Velocità, offline parziale |
| Hillshade pre-generato | Terrain-RGB client-side | Leggerezza su mobile |
| GitHub Pages | Netlify, Vercel | Zero costi certi, Git nativo |
