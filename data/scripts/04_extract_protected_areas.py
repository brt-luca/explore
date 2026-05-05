#!/usr/bin/env python3
"""
04_extract_protected_areas.py
Estrae le aree protette da OpenStreetMap via Overpass API.

Categorie estratte:
  - Parchi nazionali
  - Riserve naturali
  - Parchi regionali e naturali
  - Zone Natura 2000 (SIC/ZPS)

Area MVP: Italia settentrionale + Slovenia + Austria + Svizzera
bbox: south=43.5, west=6.0, north=48.0, east=18.0

Uso:
    cd data/scripts
    pip install requests tqdm --break-system-packages
    python 04_extract_protected_areas.py

Output:
    ../processed/protected_areas.geojson

Poi copia in:
    ../../frontend/public/geojson/protected_areas.geojson
"""

import json
import time
import requests
from pathlib import Path

# ── Configurazione ────────────────────────────────────────────────────────────

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
OUTPUT_DIR   = Path(__file__).parent.parent / "processed"
OUTPUT_DIR.mkdir(exist_ok=True)

BBOX = "43.5,6.0,48.0,18.0"

# Timeout generoso — le relazioni (poligoni) sono pesanti
TIMEOUT = 120

# ── Query ─────────────────────────────────────────────────────────────────────

# Estrae way e relation con boundary=protected_area o leisure=nature_reserve.
# Usiamo [out:json][timeout:X] e "out geom" per avere la geometria completa
# (non solo il centroide) così possiamo costruire i poligoni.
QUERY = f"""
[out:json][timeout:{TIMEOUT}];
(
  way["boundary"="protected_area"]["protect_class"~"^(1|2|3|4|5)$"]({BBOX});
  relation["boundary"="protected_area"]["protect_class"~"^(1|2|3|4|5)$"]({BBOX});
  way["leisure"="nature_reserve"]({BBOX});
  relation["leisure"="nature_reserve"]({BBOX});
  way["boundary"="national_park"]({BBOX});
  relation["boundary"="national_park"]({BBOX});
);
out geom;
"""

# ── Classificazione per protect_class ─────────────────────────────────────────

def classify_area(tags):
    """Restituisce categoria e colore in base ai tag OSM."""
    boundary  = tags.get("boundary", "")
    leisure   = tags.get("leisure", "")
    pclass    = tags.get("protect_class", "")
    iucn      = tags.get("iucn_level", "")

    if boundary == "national_park" or pclass in ("1", "2") or iucn in ("Ia", "Ib", "II"):
        return "Parco Nazionale", "#1a7a4f"
    if pclass in ("3", "4") or iucn in ("III", "IV"):
        return "Riserva Naturale", "#2d9e6b"
    if leisure == "nature_reserve":
        return "Riserva Naturale", "#2d9e6b"
    if pclass == "5" or iucn == "V":
        return "Parco Regionale", "#44bb88"
    return "Area Protetta", "#3aaa70"


# ── Geometria ─────────────────────────────────────────────────────────────────

def nodes_to_coords(nodes):
    """Converte lista di nodi Overpass in coordinate GeoJSON [lon, lat]."""
    return [[n["lon"], n["lat"]] for n in nodes]


def element_to_feature(element):
    """
    Converte un elemento OSM (way o relation) in un Feature GeoJSON Polygon.
    Overpass con 'out geom' fornisce la geometria inline.
    """
    tags     = element.get("tags", {})
    name     = (tags.get("name") or tags.get("name:it") or
                tags.get("name:en") or "Area senza nome")
    category, color = classify_area(tags)
    osm_type = element["type"]
    osm_id   = element["id"]

    geometry = None

    if osm_type == "way":
        nodes = element.get("geometry", [])
        if len(nodes) < 4:
            return None
        coords = nodes_to_coords(nodes)
        # Chiudi il poligono se non è già chiuso
        if coords[0] != coords[-1]:
            coords.append(coords[0])
        geometry = {"type": "Polygon", "coordinates": [coords]}

    elif osm_type == "relation":
        # Per le relation prendiamo il membro "outer" principale
        members = element.get("members", [])
        outer_rings = []
        inner_rings = []
        for member in members:
            if member.get("type") != "way":
                continue
            geom = member.get("geometry", [])
            if len(geom) < 2:
                continue
            coords = nodes_to_coords(geom)
            if coords[0] != coords[-1]:
                coords.append(coords[0])
            if member.get("role") == "outer":
                outer_rings.append(coords)
            elif member.get("role") == "inner":
                inner_rings.append(coords)

        if not outer_rings:
            return None

        # GeoJSON MultiPolygon se ci sono più outer ring
        if len(outer_rings) == 1:
            rings = [outer_rings[0]] + inner_rings
            geometry = {"type": "Polygon", "coordinates": rings}
        else:
            polys = [[ring] for ring in outer_rings]
            geometry = {"type": "MultiPolygon", "coordinates": polys}

    if not geometry:
        return None

    return {
        "type": "Feature",
        "geometry": geometry,
        "properties": {
            "id":       f"{osm_type}/{osm_id}",
            "name":     name,
            "category": category,
            "color":    color,
            "osm_url":  f"https://www.openstreetmap.org/{osm_type}/{osm_id}",
            "iucn":     tags.get("iucn_level", ""),
            "wikidata": tags.get("wikidata", ""),
        },
    }


# ── HTTP ──────────────────────────────────────────────────────────────────────

def overpass_query(query, retries=3):
    for attempt in range(retries):
        try:
            print(f"  Richiesta Overpass (tentativo {attempt+1}/{retries})...")
            res = requests.post(
                OVERPASS_URL,
                data={"data": query},
                timeout=TIMEOUT + 30,
                headers={"User-Agent": "mappa-esplorativa-familiare/1.0"},
            )
            res.raise_for_status()
            return res.json()
        except requests.RequestException as e:
            print(f"  Errore: {e}")
            if attempt < retries - 1:
                wait = 15 * (attempt + 1)
                print(f"  Attendo {wait}s...")
                time.sleep(wait)
    raise RuntimeError("Overpass non raggiungibile")


def save_geojson(features, path):
    fc = {"type": "FeatureCollection", "features": features}
    with open(path, "w", encoding="utf-8") as f:
        json.dump(fc, f, ensure_ascii=False, separators=(",", ":"))
    kb = path.stat().st_size / 1024
    print(f"  Salvato: {path.name} ({kb:.0f} KB, {len(features)} features)")


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("=== Estrazione Aree Protette da OSM ===")
    print(f"Area: {BBOX}")
    print()

    data = overpass_query(QUERY)
    elements = data.get("elements", [])
    print(f"  Elementi ricevuti: {len(elements)}")

    features = []
    skipped  = 0
    for el in elements:
        feat = element_to_feature(el)
        if feat:
            features.append(feat)
        else:
            skipped += 1

    print(f"  Feature valide: {len(features)} ({skipped} saltate per geometria incompleta)")

    # Statistiche per categoria
    cats = {}
    for f in features:
        c = f["properties"]["category"]
        cats[c] = cats.get(c, 0) + 1
    for c, n in sorted(cats.items(), key=lambda x: -x[1]):
        print(f"    {c}: {n}")

    out_path = OUTPUT_DIR / "protected_areas.geojson"
    save_geojson(features, out_path)

    print()
    print("✓ Fatto.")
    print(f"  Copia {out_path} in frontend/public/geojson/protected_areas.geojson")


if __name__ == "__main__":
    main()
