#!/usr/bin/env python3
"""
02_generate_hillshade.py
Genera tile hillshade dal DEM scaricato.

Richiede: gdal-bin installato nel sistema
Uso:
    python 02_generate_hillshade.py

Input:
    ../raw/dem_mvp.tif

Output:
    ../../frontend/public/hillshade/{z}/{x}/{y}.png
"""

# TODO — da implementare nella Fase 1 (pipeline dati)
# Workflow GDAL:
#
# 1. Riproietta in EPSG:3857 (Web Mercator per le tile)
#    gdalwarp -t_srs EPSG:3857 dem_mvp.tif dem_3857.tif
#
# 2. Genera hillshade
#    gdaldem hillshade dem_3857.tif hillshade.tif \
#      -az 315 -alt 45 -z 2 -combined
#
# 3. Tiling
#    gdal2tiles.py -z 5-12 -w none hillshade.tif \
#      ../../frontend/public/hillshade/
#
# Alternativa più rapida per l'MVP:
# Usare i Mapbox Terrain-RGB tiles o AWS Terrain Tiles come sorgente raster
# direttamente in MapLibre, senza generare tile locali.
# Vedi NOTE_TECNICHE.md per i dettagli.

print("Script non ancora implementato.")
print("Per l'MVP, considera l'uso di terrain tiles pubblici AWS/Mapbox come raster source.")
