# 🗺️ Mappa Esplorativa Familiare

Una mappa web personale, gratuita, bella e lenta — fatta per esplorare, non per arrivare.

---

## Filosofia

Zero abbonamenti. Zero chiavi che scadono. Un solo obiettivo: aprire la mappa e
fare brillare gli occhi, che tu sia sulle Dolomiti o sulle Ande.

---

## Struttura del progetto

```
mappa-esplorativa/
│
├── frontend/                  # Applicazione web (HTML + JS con MapLibre GL)
│   ├── src/
│   │   ├── components/        # Moduli JS: pannelli, controlli, layer
│   │   ├── styles/            # CSS globale e temi (chiaro/scuro)
│   │   ├── utils/             # Funzioni di supporto (geocoding, storage, ecc.)
│   │   └── icons/             # Set icone SVG per i "Segreti"
│   ├── public/
│   │   ├── tiles/             # Tile raster statiche (hillshade) pre-generate
│   │   ├── geojson/           # File GeoJSON statici (segreti, idrografia, ecc.)
│   │   └── hillshade/         # Tile hillshade generate da DEM
│   └── index.html             # Entry point dell'applicazione
│
├── data/                      # Pipeline dati (Python) — eseguita una tantum o periodicamente
│   ├── raw/                   # Dati grezzi scaricati (DEM, OSM export, ecc.) — NON committare file grandi
│   ├── processed/             # Output pronti per il frontend (GeoJSON puliti, tile, ecc.)
│   └── scripts/               # Script Python per download, processing, generazione tile
│       ├── 01_download_dem.py         # Scarica DEM (SRTM/EU-DEM)
│       ├── 02_generate_hillshade.py   # Genera tile hillshade da DEM
│       ├── 03_extract_secrets.py      # Estrae "Segreti" da OSM via Overpass
│       └── 04_build_geojson.py        # Pulisce e prepara GeoJSON finale
│
└── docs/                      # Documentazione interna, decisioni, note di sviluppo
    ├── ARCHITETTURA.md
    ├── FASI.md
    └── NOTE_TECNICHE.md
```

---

## Fasi di sviluppo

Vedi [`docs/FASI.md`](docs/FASI.md) per il dettaglio completo.

| Fase | Contenuto | Stato |
|------|-----------|-------|
| **1 – MVP** | Basemap + hillshade + segreti base + geolocalizzazione | 🔨 In corso |
| 2 | Meteo live, radar, modalità notte | ⏳ |
| 3 | Layer ufficiali (sentieri, ferrovie, mare) | ⏳ |
| 4 | Idee folli | ⏳ |

---

## Stack tecnico (MVP)

| Cosa | Strumento | Costo |
|------|-----------|-------|
| Mappa interattiva | [MapLibre GL JS](https://maplibre.org/) | gratuito |
| Basemap vettoriale | [OpenFreeMap](https://openfreemap.org/) | gratuito, no key |
| Hillshade | SRTM via USGS, tile pre-generate | gratuito |
| Segreti OSM | Overpass API → GeoJSON statico | gratuito |
| Ricerca luoghi | Nominatim (OSM) | gratuito, throttled |
| Hosting | GitHub Pages | gratuito |
| Build/bundler | Vite | gratuito |
| Processing dati | Python 3 + GDAL + requests | gratuito |

---

## Come avviare il frontend in locale

```bash
cd frontend
npm install
npm run dev
```

Apri `http://localhost:5173`

---

## Come eseguire la pipeline dati

```bash
cd data/scripts
pip install -r requirements.txt
python 01_download_dem.py
python 02_generate_hillshade.py
python 03_extract_secrets.py
python 04_build_geojson.py
```

I file prodotti vanno copiati in `frontend/public/`.

---

## Deploy su GitHub Pages

```bash
cd frontend
npm run build
# La cartella dist/ va pushata sul branch gh-pages
```

---

*Progetto personale, uso familiare. Niente abbonamenti, niente chiavi segrete, niente paura.*
