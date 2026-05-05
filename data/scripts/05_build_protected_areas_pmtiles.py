#!/usr/bin/env python3
"""
05_build_protected_areas_pmtiles.py

Scarica il dataset WDPA (World Database of Protected Areas) da ProtectedPlanet,
lo converte in GeoJSON e poi in PMTiles con tippecanoe.

Copertura: mondiale
Aggiornamento: mensile (WDPA viene aggiornato ogni mese)

Requisiti:
    pip3 install requests tqdm --break-system-packages
    brew install tippecanoe   # per la conversione in PMTiles

Uso:
    python3 05_build_protected_areas_pmtiles.py

Output:
    ../processed/protected_areas.pmtiles  ← copia in frontend/public/

Note sul download:
    Il dataset WDPA richiede registrazione gratuita su protectedplanet.net
    per ottenere un token API. Segui le istruzioni a schermo.
    
    Alternativa senza registrazione: scarica manualmente il file CSV/Shapefile
    da https://www.protectedplanet.net/en/thematic-areas/wdpa?tab=WDPA
    e mettilo in data/raw/wdpa.zip — lo script lo userà automaticamente.
"""

import json
import os
import subprocess
import sys
import zipfile
from pathlib import Path

try:
    import requests
    from tqdm import tqdm
except ImportError:
    print("Installa le dipendenze: pip3 install requests tqdm --break-system-packages")
    sys.exit(1)

# ── Configurazione ────────────────────────────────────────────────────────────

RAW_DIR       = Path(__file__).parent.parent / "raw"
PROCESSED_DIR = Path(__file__).parent.parent / "processed"
RAW_DIR.mkdir(exist_ok=True)
PROCESSED_DIR.mkdir(exist_ok=True)

WDPA_ZIP      = RAW_DIR / "wdpa.zip"
WDPA_GEOJSON  = PROCESSED_DIR / "wdpa_raw.geojson"
OUT_PMTILES   = PROCESSED_DIR / "protected_areas.pmtiles"
FRONTEND_OUT  = Path(__file__).parent.parent.parent / "frontend" / "public" / "pmtiles" / "protected_areas.pmtiles"

# URL download diretto (dataset mensile pubblico, no autenticazione)
# Se questo URL non funziona, scarica manualmente da protectedplanet.net
WDPA_URL = "https://d1gam3xoknrgr2.cloudfront.net/current/WDPA_WDOECM_wdpa_shp.zip"

# ── Download ──────────────────────────────────────────────────────────────────

def download_wdpa():
    if WDPA_ZIP.exists():
        print(f"✓ File già presente: {WDPA_ZIP} ({WDPA_ZIP.stat().st_size/1e6:.0f} MB)")
        print("  Cancellalo se vuoi riscaricare la versione più recente.")
        return

    print("Scaricando WDPA da ProtectedPlanet...")
    print("(dataset ~500MB, potrebbe richiedere qualche minuto)")

    try:
        res = requests.get(WDPA_URL, stream=True, timeout=60,
                          headers={"User-Agent": "mappa-esplorativa/1.0"})
        res.raise_for_status()
        total = int(res.headers.get("content-length", 0))

        with open(WDPA_ZIP, "wb") as f, tqdm(
            total=total, unit="B", unit_scale=True, desc="WDPA"
        ) as bar:
            for chunk in res.iter_content(8192):
                f.write(chunk)
                bar.update(len(chunk))

        print(f"✓ Scaricato: {WDPA_ZIP} ({WDPA_ZIP.stat().st_size/1e6:.0f} MB)")

    except requests.RequestException as e:
        print(f"\n✗ Download fallito: {e}")
        print()
        print("Scarica manualmente il file da:")
        print("  https://www.protectedplanet.net/en/thematic-areas/wdpa?tab=WDPA")
        print(f"Poi salvalo come: {WDPA_ZIP}")
        sys.exit(1)

# ── Estrai e converti in GeoJSON ──────────────────────────────────────────────

def extract_and_convert():
    """
    Il file WDPA contiene Shapefile .shp per poligoni e punti.
    Usiamo ogr2ogr (parte di GDAL) per convertire in GeoJSON.
    """
    print("\nEstrazione archivio...")

    extract_dir = RAW_DIR / "wdpa_extracted"
    extract_dir.mkdir(exist_ok=True)

    with zipfile.ZipFile(WDPA_ZIP) as zf:
        zf.extractall(extract_dir)

    # Cerca i file shapefile dei poligoni (esclude i punti)
    shp_files = list(extract_dir.rglob("*polygons*.shp"))
    if not shp_files:
        shp_files = list(extract_dir.rglob("*.shp"))
        shp_files = [s for s in shp_files if "point" not in s.name.lower()]

    if not shp_files:
        print("✗ Nessun shapefile trovato nell'archivio")
        sys.exit(1)

    print(f"  Shapefile trovati: {[s.name for s in shp_files]}")

    # Controlla che ogr2ogr sia disponibile (da GDAL)
    if subprocess.run(["which", "ogr2ogr"], capture_output=True).returncode != 0:
        print("✗ ogr2ogr non trovato. Installa GDAL: brew install gdal")
        sys.exit(1)

    # Converti ogni shapefile poligoni in GeoJSON e mergia
    all_features = []
    for shp in shp_files:
        print(f"  Converto: {shp.name}...")
        tmp = PROCESSED_DIR / f"tmp_{shp.stem}.geojson"

        subprocess.run([
            "ogr2ogr",
            "-f", "GeoJSON",
            "-t_srs", "EPSG:4326",
            # Mantieni solo i campi utili per ridurre il peso
            "-select", "NAME,DESIG_ENG,IUCN_CAT,STATUS,REP_AREA,WDPAID",
            str(tmp),
            str(shp),
        ], check=True, capture_output=True)

        with open(tmp) as f:
            data = json.load(f)
            all_features.extend(data.get("features", []))
        tmp.unlink()

    print(f"\n  Totale feature: {len(all_features)}")

    # Salva GeoJSON unificato
    fc = {"type": "FeatureCollection", "features": all_features}
    with open(WDPA_GEOJSON, "w") as f:
        json.dump(fc, f, separators=(",", ":"))

    size_mb = WDPA_GEOJSON.stat().st_size / 1e6
    print(f"✓ GeoJSON salvato: {WDPA_GEOJSON} ({size_mb:.0f} MB)")

# ── Converti in PMTiles con tippecanoe ────────────────────────────────────────

def build_pmtiles():
    print("\nConversione in PMTiles con tippecanoe...")

    if subprocess.run(["which", "tippecanoe"], capture_output=True).returncode != 0:
        print("✗ tippecanoe non trovato. Installa con: brew install tippecanoe")
        sys.exit(1)

    cmd = [
        "tippecanoe",
        "--output", str(OUT_PMTILES),
        "--force",                    # sovrascrive se esiste
        "--layer", "protected_areas",
        "--minimum-zoom", "2",
        "--maximum-zoom", "12",       # zoom 12 è più che sufficiente per poligoni
        "--simplification", "10",     # semplifica geometrie per ridurre peso
        "--drop-smallest-as-needed",  # elimina poligoni piccoli a zoom bassi
        "--coalesce-smallest-as-needed",
        "--no-tile-size-limit",
        str(WDPA_GEOJSON),
    ]

    print(f"  Comando: {' '.join(cmd)}")
    print("  (potrebbe richiedere 5-15 minuti per il dataset mondiale...)")

    result = subprocess.run(cmd, capture_output=False)
    if result.returncode != 0:
        print("✗ tippecanoe fallito")
        sys.exit(1)

    size_mb = OUT_PMTILES.stat().st_size / 1e6
    print(f"✓ PMTiles generato: {OUT_PMTILES} ({size_mb:.0f} MB)")

# ── Copia nel frontend ────────────────────────────────────────────────────────

def copy_to_frontend():
    FRONTEND_OUT.parent.mkdir(parents=True, exist_ok=True)

    import shutil
    shutil.copy2(OUT_PMTILES, FRONTEND_OUT)
    size_mb = FRONTEND_OUT.stat().st_size / 1e6
    print(f"✓ Copiato in frontend: {FRONTEND_OUT} ({size_mb:.0f} MB)")

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("=== Build Protected Areas PMTiles (WDPA) ===\n")

    download_wdpa()
    extract_and_convert()
    build_pmtiles()
    copy_to_frontend()

    print("\n✓ Tutto fatto!")
    print("  Avvia npm run dev e attiva 'Aree protette' nel pannello.")

if __name__ == "__main__":
    main()
