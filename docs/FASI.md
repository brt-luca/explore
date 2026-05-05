# Fasi di sviluppo

## Regola generale

Un passo alla volta. Ogni fase deve essere **stabile e godibile** prima di
passare alla successiva. Non si aggiunge nulla finché il passo corrente
non funziona bene su mobile e desktop.

---

## Fase 1 — MVP ✅ obiettivo corrente

**Criterio di completamento:** un familiare poco tecnico apre la pagina,
vede la mappa con il rilievo, trova un castello vicino a casa e ci clicca
sopra — senza istruzioni.

### Checklist

- [ ] Basemap vettoriale da OpenFreeMap (stile Positron/Bright, modificato il minimo)
- [ ] Hillshade sovrapposto (tile raster pre-generate da SRTM)
- [ ] Controllo etichette on/off
- [ ] Pannello layer comprimibile (basemap + hillshade per ora)
- [ ] GeoJSON segreti: 5 categorie (rovine, castelli, grotte, panoramici, sorgenti)
  - Area: Italia settentrionale + Slovenia + Austria
  - Icone Maki ricolorate per categoria
  - Popup con nome, categoria, link OSM
  - Filtro per categoria
- [ ] Geolocalizzazione GPS
- [ ] Ricerca Nominatim con throttling
- [ ] Layout responsive: mobile semplificato, desktop più ricco
- [ ] Deploy su GitHub Pages funzionante

### Cosa NON entra nella Fase 1

Radar meteo, isolinee, qualità aria, OpenSeaMap, ferrovie, trasporto pubblico,
modalità notte, PMTiles, esportazione alta risoluzione, annotazioni, viste
salvate, idee folli.

---

## Fase 2 — Meteo & live

- Radar pioggia animato (RainViewer)
- Meteo puntuale Open-Meteo (vento, temperatura, previsioni 16gg)
- Modalità notte (tema scuro derivato dallo stesso stile vettoriale)
- Qualità dell'aria (Open-Meteo AQ, attivazione manuale)

---

## Fase 3 — Layer ufficiali

- Sentieri escursionistici/MTB (Waymarked Trails o layer OSM)
- Ferrovie (OpenRailwayMap o vettoriale OSM)
- Trasporto pubblico (ÖPNVKarte)
- Mare (OpenSeaMap)
- Idrografia (fiumi, laghi da OSM come GeoJSON/PMTiles)
- Confini amministrativi

---

## Fase 4 — Idee folli

- Webcam pubbliche geolocalizzate
- Layer Wikipedia
- Inquinamento luminoso (VIIRS raster statico)
- Satellite Sentinel-2
- Layer sonoro
- Mappa del silenzio
- "Dov'ero quel giorno?" con Sentinel-2
- Easter egg casa base
- ... e quelle che nasceranno durante lo sviluppo
