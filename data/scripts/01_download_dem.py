#!/usr/bin/env python3
"""
01_download_dem.py
Scarica il DEM (Digital Elevation Model) per l'area MVP.

Fonte: SRTM 30m via OpenTopography (no key necessaria per uso base)
Alternativa: EU-DEM 25m via Copernicus (richiede registrazione gratuita)

Uso:
    python 01_download_dem.py

Output:
    ../raw/dem_mvp.tif
"""

# TODO — da implementare nella Fase 1 (pipeline dati)
# Questo script viene eseguito UNA VOLTA per generare i dati statici.
# Non è necessario per avviare il frontend in locale con dati di test.

# Opzione A: OpenTopography API (richiede key gratuita)
# https://opentopography.org/developers

# Opzione B: Download manuale SRTM da USGS EarthExplorer
# https://earthexplorer.usgs.gov/

# Opzione C: AWS Terrain Tiles (pubblico, no key)
# https://registry.opendata.aws/terrain-tiles/

print("Script non ancora implementato.")
print("Per l'MVP, usa i tile hillshade pre-generati da un servizio pubblico.")
print("Es: https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png")
