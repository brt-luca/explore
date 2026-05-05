#!/usr/bin/env python3
"""
03_extract_secrets.py
Estrae i Segreti da OSM usando file PBF di Geofabrik (no rate limit, tutto offline).

Flusso:
  1. Scarica il PBF Europa da Geofabrik (~25GB) — una volta sola
  2. Filtra i tag rilevanti con osmium — velocissimo
  3. Converte in GeoJSON con parsing diretto
  4. Copia nel frontend

Requisiti:
    brew install osmium-tool
    pip3 install requests tqdm --break-system-packages

Uso:
    python3 03_extract_secrets.py                  # scarica Europa intera
    python3 03_extract_secrets.py --country italy  # solo un paese (più veloce per test)
    python3 03_extract_secrets.py --skip-download  # se hai già il PBF
    python3 03_extract_secrets.py --pmtiles        # genera anche PMTiles
"""

import json, sys, time, shutil, argparse, subprocess, struct, zlib
from pathlib import Path

try:
    import requests
    from tqdm import tqdm
except ImportError:
    print("Installa: pip3 install requests tqdm --break-system-packages")
    sys.exit(1)

# ── Config ────────────────────────────────────────────────────────────────────

RAW_DIR       = Path(__file__).parent.parent / "raw"
PROCESSED_DIR = Path(__file__).parent.parent / "processed"
RAW_DIR.mkdir(exist_ok=True)
PROCESSED_DIR.mkdir(exist_ok=True)

GEOJSON_OUT   = PROCESSED_DIR / "secrets.geojson"
PMTILES_OUT   = PROCESSED_DIR / "secrets.pmtiles"
FRONTEND_JSON = Path(__file__).parent.parent.parent / "frontend" / "public" / "geojson" / "secrets.geojson"
FRONTEND_PMT  = Path(__file__).parent.parent.parent / "frontend" / "public" / "pmtiles" / "secrets.pmtiles"

# File Geofabrik disponibili
GEOFABRIK_SOURCES = {
    "europe":          ("https://download.geofabrik.de/europe-latest.osm.pbf", "europe-latest.osm.pbf"),
    "italy":           ("https://download.geofabrik.de/europe/italy-latest.osm.pbf", "italy-latest.osm.pbf"),
    "france":          ("https://download.geofabrik.de/europe/france-latest.osm.pbf", "france-latest.osm.pbf"),
    "germany":         ("https://download.geofabrik.de/europe/germany-latest.osm.pbf", "germany-latest.osm.pbf"),
    "spain":           ("https://download.geofabrik.de/europe/spain-latest.osm.pbf", "spain-latest.osm.pbf"),
    "switzerland":     ("https://download.geofabrik.de/europe/switzerland-latest.osm.pbf", "switzerland-latest.osm.pbf"),
    "austria":         ("https://download.geofabrik.de/europe/austria-latest.osm.pbf", "austria-latest.osm.pbf"),
    "alps":            ("https://download.geofabrik.de/europe/alps-latest.osm.pbf", "alps-latest.osm.pbf"),
}

# ── Tag OSM da estrarre ───────────────────────────────────────────────────────
# Formato osmium: "key=value" o "key" (qualsiasi valore)

TAG_FILTERS = {
    # Storia
    "castle":         [("historic", "castle"), ("historic", "fort")],
    "ruins":          [("historic", "ruins")],
    "archaeology":    [("historic", "archaeological_site")],
    "monument":       [("historic", "monument"), ("historic", "memorial")],
    "battlefield":    [("historic", "battlefield")],
    "monastery":      [("historic", "monastery"), ("historic", "abbey")],
    "wayside":        [("historic", "wayside_cross"), ("historic", "wayside_shrine")],
    # Natura
    "cave":           [("natural", "cave_entrance")],
    "peak":           [("natural", "peak")],
    "viewpoint":      [("tourism", "viewpoint")],
    "spring":         [("natural", "spring")],
    "waterfall":      [("waterway", "waterfall")],
    "volcano":        [("natural", "volcano")],
    "tree":           [("natural", "tree"), ("denotation", "natural_monument")],
    "beach":          [("leisure", "swimming_area"), ("natural", "beach")],
    # Esplorazione
    "mine":           [("historic", "mine"), ("man_made", "adit"), ("man_made", "mineshaft")],
    "bunker":         [("military", "bunker"), ("historic", "bunker")],
    "industrial":     [("historic", "industrial")],
    "abandoned_rail": [("railway", "abandoned"), ("railway", "disused")],
    "ghost_station":  [("disused:railway", "station")],
    "wreck":          [("historic", "wreck"), ("historic", "aircraft")],
    # Tappa
    "alpine_hut":     [("tourism", "alpine_hut"), ("tourism", "wilderness_hut")],
    "artwork":        [("tourism", "artwork")],
}

# ── Download ──────────────────────────────────────────────────────────────────

def download_pbf(country):
    url, filename = GEOFABRIK_SOURCES[country]
    pbf_path = RAW_DIR / filename

    if pbf_path.exists():
        size_gb = pbf_path.stat().st_size / 1e9
        print(f"✓ File già presente: {pbf_path} ({size_gb:.1f} GB)")
        print("  Cancellalo se vuoi riscaricare.")
        return pbf_path

    print(f"Scaricando {filename} da Geofabrik...")
    print(f"URL: {url}")
    if country == "europe":
        print("⚠️  Il file Europa è ~25GB — ci vuole tempo con connessione normale.")
        print("   Considera di partire con --country italy o --country alps per testare.\n")

    res = requests.get(url, stream=True, timeout=60,
                      headers={"User-Agent": "mappa-esplorativa/1.0"})
    res.raise_for_status()
    total = int(res.headers.get("content-length", 0))

    with open(pbf_path, "wb") as f, tqdm(
        total=total, unit="B", unit_scale=True, desc=filename
    ) as bar:
        for chunk in res.iter_content(65536):
            f.write(chunk)
            bar.update(len(chunk))

    print(f"✓ Scaricato: {pbf_path} ({pbf_path.stat().st_size/1e9:.1f} GB)")
    return pbf_path

# ── Filtro con osmium ─────────────────────────────────────────────────────────

def filter_with_osmium(pbf_path):
    """
    Usa osmium tags-filter per estrarre solo gli elementi con i tag che ci interessano.
    Molto più veloce di parsare tutto il PBF.
    """
    filtered_path = PROCESSED_DIR / "secrets_filtered.osm.pbf"

    # Costruisce la lista di filtri osmium
    # Formato: "key=value" per valore specifico, "key" per qualsiasi valore
    osmium_tags = set()
    for category, tag_pairs in TAG_FILTERS.items():
        for key, value in tag_pairs:
            if value:
                osmium_tags.add(f"{key}={value}")
            else:
                osmium_tags.add(key)

    print(f"\nFiltrando con osmium ({len(osmium_tags)} tag patterns)...")
    print(f"Input: {pbf_path} ({pbf_path.stat().st_size/1e9:.1f} GB)")

    cmd = [
        "osmium", "tags-filter",
        str(pbf_path),
        "--overwrite",
        "-o", str(filtered_path),
    ] + list(osmium_tags)

    result = subprocess.run(cmd, capture_output=False)
    if result.returncode != 0:
        print("✗ osmium fallito")
        sys.exit(1)

    size_mb = filtered_path.stat().st_size / 1e6
    print(f"✓ Filtrato: {filtered_path} ({size_mb:.0f} MB)")
    return filtered_path

# ── Conversione PBF → GeoJSON ─────────────────────────────────────────────────

def convert_to_geojson(filtered_pbf):
    """
    Usa osmium export per convertire il PBF filtrato in GeoJSON.
    Poi assegna la categoria a ogni feature basandosi sui tag.
    """
    raw_geojson = PROCESSED_DIR / "secrets_raw.geojson"

    print(f"\nConvertendo in GeoJSON con osmium export...")
    cmd = [
        "osmium", "export",
        str(filtered_pbf),
        "--overwrite",
        "-o", str(raw_geojson),
        "--geometry-types=point",       # solo punti (centroidi per way/relation)
        "--add-unique-id=counter",
        "--config", "/dev/stdin",       # config inline
    ]

    # Config osmium export: esporta tutti i tag come proprietà
    config = json.dumps({
        "attributes": {"id": True, "version": False, "timestamp": False,
                       "changeset": False, "uid": False, "user": False},
        "linear_tags": True,
        "area_tags": True,
    })

    result = subprocess.run(cmd, input=config, text=True, capture_output=True)

    if result.returncode != 0 or not raw_geojson.exists():
        # Fallback: usa osmium con output GeoJSON senza config
        cmd2 = [
            "osmium", "export",
            str(filtered_pbf),
            "--overwrite",
            "-o", str(raw_geojson),
            "--geometry-types=point",
        ]
        result2 = subprocess.run(cmd2, capture_output=False)
        if result2.returncode != 0:
            print("✗ osmium export fallito")
            sys.exit(1)

    size_mb = raw_geojson.stat().st_size / 1e6
    print(f"✓ GeoJSON grezzo: {raw_geojson} ({size_mb:.0f} MB)")
    return raw_geojson

# ── Classificazione e pulizia ─────────────────────────────────────────────────

def assign_category(props):
    """Assegna la categoria OSM giusta basandosi sui tag della feature."""
    historic  = props.get("historic", "")
    natural   = props.get("natural", "")
    tourism   = props.get("tourism", "")
    military  = props.get("military", "")
    waterway  = props.get("waterway", "")
    leisure   = props.get("leisure", "")
    railway   = props.get("railway", "")
    disused_r = props.get("disused:railway", "")
    man_made  = props.get("man_made", "")
    denotat   = props.get("denotation", "")

    if historic in ("castle", "fort"):           return "castle"
    if historic == "ruins":                       return "ruins"
    if historic == "archaeological_site":         return "archaeology"
    if historic in ("monument", "memorial"):      return "monument"
    if historic == "battlefield":                 return "battlefield"
    if historic in ("monastery", "abbey"):        return "monastery"
    if historic in ("wayside_cross", "wayside_shrine"): return "wayside"
    if natural == "cave_entrance":                return "cave"
    if natural == "peak":                         return "peak"
    if tourism == "viewpoint":                    return "viewpoint"
    if natural == "spring":                       return "spring"
    if waterway == "waterfall":                   return "waterfall"
    if natural == "volcano":                      return "volcano"
    if natural == "tree" and denotat == "natural_monument": return "tree"
    if leisure == "swimming_area":                return "beach"
    if natural == "beach":                        return "beach"
    if historic == "mine" or man_made in ("adit", "mineshaft"): return "mine"
    if military == "bunker" or historic == "bunker": return "bunker"
    if historic == "industrial":                  return "industrial"
    if railway in ("abandoned", "disused"):       return "abandoned_rail"
    if disused_r == "station":                    return "ghost_station"
    if historic in ("wreck", "aircraft"):         return "wreck"
    if tourism in ("alpine_hut", "wilderness_hut"): return "alpine_hut"
    if tourism == "artwork":                      return "artwork"
    return None

def clean_and_categorize(raw_geojson_path):
    """Legge il GeoJSON grezzo, assegna categorie, rimuove duplicati."""
    print(f"\nPulizia e categorizzazione...")

    features = []
    seen_ids  = set()
    skipped   = 0
    no_cat    = 0

    with open(raw_geojson_path, encoding="utf-8") as f:
        # osmium export produce un GeoJSON valido
        data = json.load(f)

    for feat in data.get("features", []):
        props = feat.get("properties", {}) or {}
        geom  = feat.get("geometry", {})

        # Solo punti
        if not geom or geom.get("type") != "Point":
            skipped += 1
            continue

        category = assign_category(props)
        if not category:
            no_cat += 1
            continue

        # ID unico
        osm_id = str(props.get("@id") or props.get("id") or feat.get("id", ""))
        if osm_id in seen_ids:
            continue
        seen_ids.add(osm_id)

        name = (props.get("name") or props.get("name:it") or
                props.get("name:en") or props.get("name:de"))

        coords = geom["coordinates"]
        osm_url = f"https://www.openstreetmap.org/"
        if osm_id.startswith("node/") or osm_id.startswith("way/"):
            osm_url += osm_id
        else:
            osm_url += f"node/{osm_id}"

        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": coords},
            "properties": {
                "id":          osm_id,
                "name":        name,
                "category":    category,
                "osm_url":     osm_url,
                "ele":         props.get("ele"),
                "description": props.get("description") or props.get("note"),
                "wikipedia":   props.get("wikipedia"),
                "wikidata":    props.get("wikidata"),
            },
        })

    # Stats per categoria
    cats = {}
    for f in features:
        c = f["properties"]["category"]
        cats[c] = cats.get(c, 0) + 1

    print(f"  Feature totali: {len(features)}")
    print(f"  Saltate (no punto): {skipped}")
    print(f"  Senza categoria: {no_cat}")
    print("\n  Per categoria:")
    for cat, n in sorted(cats.items(), key=lambda x: -x[1]):
        print(f"    {cat}: {n}")

    return features

# ── Main ──────────────────────────────────────────────────────────────────────

def main(country="europe", skip_download=False, make_pmtiles=False):
    print(f"=== Estrazione Segreti OSM ({country}) ===\n")

    # Verifica osmium
    if subprocess.run(["which", "osmium"], capture_output=True).returncode != 0:
        print("✗ osmium non trovato: brew install osmium-tool")
        sys.exit(1)

    # 1. Download PBF
    pbf_path = RAW_DIR / GEOFABRIK_SOURCES[country][1]
    if skip_download and pbf_path.exists():
        print(f"✓ Usando PBF esistente: {pbf_path}")
    else:
        pbf_path = download_pbf(country)

    # 2. Filtro con osmium
    filtered = filter_with_osmium(pbf_path)

    # 3. Conversione in GeoJSON
    raw_geojson = convert_to_geojson(filtered)

    # 4. Pulizia e categorizzazione
    features = clean_and_categorize(raw_geojson)

    # 5. Salva GeoJSON finale
    fc = {"type": "FeatureCollection", "features": features}
    with open(GEOJSON_OUT, "w", encoding="utf-8") as f:
        json.dump(fc, f, ensure_ascii=False, separators=(",", ":"))
    size_mb = GEOJSON_OUT.stat().st_size / 1e6
    print(f"\n✓ GeoJSON finale: {GEOJSON_OUT} ({size_mb:.1f} MB)")

    # 6. Copia nel frontend
    FRONTEND_JSON.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(GEOJSON_OUT, FRONTEND_JSON)
    print(f"✓ Copiato in frontend/public/geojson/secrets.geojson")

    # 7. PMTiles opzionale
    if make_pmtiles:
        if subprocess.run(["which", "tippecanoe"], capture_output=True).returncode != 0:
            print("✗ tippecanoe non trovato: brew install tippecanoe")
        else:
            print("\nGenerando PMTiles...")
            cmd = [
                "tippecanoe",
                "--output", str(PMTILES_OUT), "--force",
                "--layer", "secrets",
                "--minimum-zoom", "4", "--maximum-zoom", "14",
                "--cluster-distance", "30", "--cluster-maxzoom", "12",
                str(GEOJSON_OUT),
            ]
            if subprocess.run(cmd).returncode == 0:
                FRONTEND_PMT.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(PMTILES_OUT, FRONTEND_PMT)
                print(f"✓ PMTiles: {PMTILES_OUT.stat().st_size/1e6:.1f} MB")

    # Pulizia file intermedi
    for f in [PROCESSED_DIR / "secrets_filtered.osm.pbf",
              PROCESSED_DIR / "secrets_raw.geojson"]:
        if f.exists():
            f.unlink()

    print("\n✓ Fatto! Riavvia npm run dev.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--country", default="europe",
                        choices=list(GEOFABRIK_SOURCES.keys()),
                        help="Area geografica (default: europe)")
    parser.add_argument("--skip-download", action="store_true",
                        help="Usa PBF già scaricato")
    parser.add_argument("--pmtiles", action="store_true",
                        help="Genera anche PMTiles (richiede tippecanoe)")
    args = parser.parse_args()
    main(country=args.country, skip_download=args.skip_download,
         make_pmtiles=args.pmtiles)
