#!/usr/bin/env python3
"""
filter_geojson.py
Filtra il GeoJSON dei segreti per area geografica e categorie prioritarie.
Produce un file leggero (~2-3MB) per GitHub Pages.
"""

import json
import shutil
from pathlib import Path

INPUT   = Path(__file__).parent.parent / "processed" / "secrets.geojson"
OUTPUT  = Path(__file__).parent.parent.parent / "frontend" / "public" / "geojson" / "secrets.geojson"

# Bbox Nord Italia + Slovenia + Austria + Svizzera
BBOX = {"min_lon": 6.5, "max_lon": 18.0, "min_lat": 43.5, "max_lat": 48.0}

# Categorie prioritarie — le più interessanti visivamente
PRIORITY_CATEGORIES = {
    "castle", "ruins", "cave", "peak", "viewpoint",
    "waterfall", "mine", "alpine_hut", "monastery",
    "archaeology", "bunker", "volcano", "tree"
}

# Limite massimo punti per categoria (per tenere il file leggero)
MAX_PER_CATEGORY = 500

def main():
    print(f"Caricamento {INPUT}...")
    with open(INPUT, encoding="utf-8") as f:
        data = json.load(f)

    features = data["features"]
    print(f"Totale features: {len(features)}")

    # Filtra per bbox e categoria
    filtered = []
    counts = {}

    for feat in features:
        props = feat.get("properties", {})
        cat   = props.get("category", "")
        coords = feat["geometry"]["coordinates"]
        lon, lat = coords[0], coords[1]

        # Solo categorie prioritarie
        if cat not in PRIORITY_CATEGORIES:
            continue

        # Solo nell'area geografica
        if not (BBOX["min_lon"] <= lon <= BBOX["max_lon"] and
                BBOX["min_lat"] <= lat <= BBOX["max_lat"]):
            continue

        # Limite per categoria
        counts[cat] = counts.get(cat, 0)
        if counts[cat] >= MAX_PER_CATEGORY:
            continue

        counts[cat] += 1
        filtered.append(feat)

    print(f"\nFeature filtrate: {len(filtered)}")
    print("\nPer categoria:")
    for cat, n in sorted(counts.items(), key=lambda x: -x[1]):
        print(f"  {cat}: {n}")

    # Salva
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    fc = {"type": "FeatureCollection", "features": filtered}
    with open(OUTPUT, "w", encoding="utf-8") as f:
        json.dump(fc, f, ensure_ascii=False, separators=(",", ":"))

    size_mb = OUTPUT.stat().st_size / 1e6
    print(f"\n✓ Salvato: {OUTPUT} ({size_mb:.1f} MB)")

if __name__ == "__main__":
    main()
