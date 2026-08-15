#!/usr/bin/env bash
# Downloads input data: ANM GTFS feed, OSM networks (Overpass), MapLibre GL.
# Everything is cached — re-running only fetches what is missing.
#
# ONE feed covers everything Azienda Napoletana Mobilità runs (anm.it):
# buses and trolleybuses, the three tram lines, Metro L1 and L6, the three
# funiculars, plus Trenitalia's Linea 2 which ANM publishes with them.
# Modes are separated by route_type at build time.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p data/gtfs data/osm web/vendor

# 1) GTFS — ANM's Google Transit bundle (stable URL, refreshed in place)
if [ ! -f data/gtfs/routes.txt ]; then
  echo "== ANM GTFS (Naples) =="
  curl -fL --retry 3 --max-time 600 -o data/naples.zip \
    "http://www.anm.it/google/google-transit.zip"
  unzip -o data/naples.zip -d data/gtfs
fi

# 2) OSM — roadways over the feed's extent (40.76-40.95 N, 14.12-14.43 E) plus
#    margin: Pozzuoli and the Campi Flegrei to the west, Portici and San Giorgio
#    to the east, the Vomero and Capodimonte hills to the north.
if [ ! -f data/osm/naples.json ]; then
  echo "== Overpass (roads) =="
  Q='[out:json][timeout:900];way(40.72,14.07,40.99,14.50)["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|service|busway|construction|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link)$"];out geom;'
  ok=0
  for EP in "https://overpass-api.de/api/interpreter" \
            "https://maps.mail.ru/osm/tools/overpass/api/interpreter" \
            "https://overpass.kumi.systems/api/interpreter"; do
    echo "-- $EP"
    if curl -fsS --max-time 900 -o data/osm/naples.json --data-urlencode "data=$Q" "$EP" \
       && grep -q '"elements"' data/osm/naples.json; then
      ok=1; break
    fi
  done
  [ "$ok" = 1 ] || { echo "Overpass: all mirrors failed" >&2; exit 1; }
fi

# 2b) OSM — rails for the three rail cfgs: tram tracks, metro tunnels
#     (railway=subway for L1 and L6), the funicular tracks of Chiaia, Centrale
#     and Mergellina, and mainline rail — Linea 2 is Trenitalia's Passante,
#     it runs on the national network. Same bbox as the roads.
if [ ! -f data/osm/naples-rail.json ]; then
  echo "== Overpass (rails) =="
  QT='[out:json][timeout:600];way(40.72,14.07,40.99,14.50)["railway"~"^(subway|tram|light_rail|rail|funicular)$"];out geom;'
  ok=0
  for EP in "https://overpass-api.de/api/interpreter" \
            "https://maps.mail.ru/osm/tools/overpass/api/interpreter" \
            "https://overpass.kumi.systems/api/interpreter"; do
    echo "-- $EP"
    if curl -fsS --max-time 600 -o data/osm/naples-rail.json --data-urlencode "data=$QT" "$EP" \
       && grep -q '"elements"' data/osm/naples-rail.json; then
      ok=1; break
    fi
  done
  [ "$ok" = 1 ] || { echo "Overpass (rails): all mirrors failed" >&2; exit 1; }
fi

# 2c) OSM — every NAMED feature in the same bbox, tags only. Not geometry: this
#     is the spelling dictionary. ANM shouts every stop name (VIA S. CATERINA DA
#     SIENA) and Italian drops its accents in capitals, so the feed cannot tell
#     us that PIAZZA TRIESTE E TRENTO keeps "e" lowercase or that UNIVERSITA is
#     Università — OSM spells the same words properly on streets, squares and
#     districts. See pipeline/lib/italian.mjs.
if [ ! -f data/osm/naples-names.json ]; then
  echo "== Overpass (names for the Italian dictionary) =="
  QN='[out:json][timeout:600];nwr(40.72,14.07,40.99,14.50)[name][~"^(amenity|place|tourism|leisure|shop|building|railway|public_transport|natural|waterway|landuse|historic|office|man_made|highway)$"~"."];out tags;'
  ok=0
  for EP in "https://overpass-api.de/api/interpreter" \
            "https://maps.mail.ru/osm/tools/overpass/api/interpreter" \
            "https://overpass.kumi.systems/api/interpreter"; do
    echo "-- $EP"
    if curl -fsS --max-time 600 -o data/osm/naples-names.json --data-urlencode "data=$QN" "$EP" \
       && grep -q '"elements"' data/osm/naples-names.json; then
      ok=1; break
    fi
  done
  # not fatal: without it the stop names simply come out unaccented
  [ "$ok" = 1 ] || echo "Overpass (names): all mirrors failed — stop names will lose their accents" >&2
fi

# 3) MapLibre GL (vendored, no CDN at runtime)
if [ ! -f web/vendor/maplibre-gl.js ]; then
  echo "== MapLibre GL =="
  curl -fL --retry 3 -o web/vendor/maplibre-gl.js  https://unpkg.com/maplibre-gl@5.6.1/dist/maplibre-gl.js
  curl -fL --retry 3 -o web/vendor/maplibre-gl.css https://unpkg.com/maplibre-gl@5.6.1/dist/maplibre-gl.css
fi

echo "OK — data ready:"
du -sh data/naples.zip data/osm/naples.json data/osm/naples-rail.json data/osm/naples-names.json 2>/dev/null || true
