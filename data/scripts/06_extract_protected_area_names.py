#!/usr/bin/env python3
"""
06_extract_protected_area_names.py
Estrae i nomi delle aree protette da OSM via Overpass API.
Produce centroidi puntiformi con nome — usati come etichette sulla mappa.

Uso:
    python3 06_extract_protected_area_names.py
"""

import json
import time
import shutil
import requests
from pathlib import Path

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
OUTPUT_DIR   = Path(__file__).parent.parent / "processed"
OUTPUT_DIR.mkdir(exist_ok=True)

FRONTEND_OUT = Path(__file__).parent.parent.parent / "frontend" / "public" / "geojson" / "protected_area_names.geojson"

# Bbox ridotto: Europa occidentale e centrale (meno pesante per Overpass)
BBOX = "35.0,-10.0,65.0,30.0"

QUERY = f"""
[out:json][timeout:60];
(
  relation["boundary"="national_park"]["name"]({BBOX});
  relation["boundary"="protected_area"]["name"]["protect_class"~"^(1|2|3)$"]({BBOX});
);
out center tags;
"""

def overpass_query(query, retries=3):
    for attempt in range(retries):
        try:
            print(f"  Tentativo {attempt+1}/{retries}...")
            res = requests.post(
                OVERPASS_URL,
                data={"data": query},
                timeout=90,
                headers={"User-Agent": "mappa-esplorativa/1.0"},
            )
            res.raise_for_status()
            return res.json()
        except Exception as e:
            print(f"  Errore: {e}")
            if attempt < retries - 1:
                print(f"  Attendo 15s...")
                time.sleep(15)
    raise RuntimeError("Overpass non raggiungibile dopo tutti i tentativi")

def main():
    print("=== Estrazione nomi aree protette ===")
    print(f"Area: {BBOX}\n")

    data = overpass_query(QUERY)
    elements = data.get("elements", [])
    print(f"Elementi ricevuti: {len(elements)}")

    features = []
    for el in elements:
        tags = el.get("tags", {})
        name = tags.get("name") or tags.get("name:it") or tags.get("name:en")
        if not name:
            continue
        center = el.get("center", {})
        if not center:
            continue
        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [center["lon"], center["lat"]],
            },
            "properties": {"name": name},
        })

    print(f"Feature con nome: {len(features)}")

    out = OUTPUT_DIR / "protected_area_names.geojson"
    with open(out, "w", encoding="utf-8") as f:
        json.dump({"type": "FeatureCollection", "features": features},
                  f, ensure_ascii=False, separators=(",", ":"))
    print(f"✓ Salvato: {out}")

    # Copia automatica nel frontend
    FRONTEND_OUT.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(out, FRONTEND_OUT)
    print(f"✓ Copiato in: {FRONTEND_OUT}")
    print("\nRiavvia npm run dev e attiva 'Aree protette' nel pannello.")

if __name__ == "__main__":
    main()
