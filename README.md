# Naples Public Transport — interactive map

Interactive, poster-grade map of the public transport network of **Naples**:
ANM buses and trolleybuses, the three tram lines, the metro (L1, L6 and
Trenitalia's Linea 2, drawn in the official line colors), the Chiaia, Centrale
and Mergellina funiculars, and the **EAV railways** — Circumvesuviana, Cumana,
Circumflegrea and the Aversa and Piedimonte lines — 125 lines drawn along the
real street and track geometry.

## Live

**https://miqell24.github.io/naples-bus-map/** — GitHub Pages from `main:/docs`.

Two feeds feed the map: ANM's Google Transit bundle
(http://www.anm.it/google/google-transit.zip) split by `route_type`, and EAV's
"ferro e gomma" GTFS (rail half only):

| mode | route_type | lines | graph |
|---|---|---|---|
| buses | 3 | 101 ANM city lines | OSM roadways |
| trolleybuses | 11 | 201, 202, 204, 254 — drawn green on the bus network | OSM roadways |
| trams | 0 | 412, 421, 422 | `railway=tram` tracks |
| metro | 1 | L1 and L6, official colors from `routes.txt` | `railway=subway` tunnels |
| Linea 2 | 1 | Trenitalia's Passante, published with the ANM feed | `railway=rail` mainline |
| funiculars | 7 | F1 Chiaia, F3 Centrale, F4 Mergellina | `railway=funicular` |
| EAV rail | 2 | E1–E9b: Vesuviane (red), Cumana & Circumflegrea (blue), Aversa & Piedimonte (violet) — own feed from [eavsrl.it/open-data](https://www.eavsrl.it/open-data/) | `railway=rail/narrow_gauge/subway`, own extract |

Build quirks worth knowing:

* **Stop names arrive in capitals** — all 1636 of them. Italian drops its
  accents in capitals and keeps its articles lowercase inside a name, so the
  feed alone cannot produce "Arena alla Sanità"; `pipeline/lib/italian.mjs`
  builds a spelling dictionary out of the OSM extract and rewrites the names
  word by word through it. A bare `V.` is expanded to *Via* only where a name
  starts — mid-name it is Vittorio ("Corso V. Emanuele").
* **L1 comes one-way**: all 353 trips are `direction_id=0`, Piscinola →
  Tribunale, on a single shape, and the headsigns are empty, so there is no
  return to recover. The corridor is drawn once. Re-check on every feed
  refresh.
* **Rails are split four ways** — tram, subway, mainline and funicular each get
  their own matching graph. A metro shape often passes closer to the tram track
  or the mainline above its tunnel than to its own axis, and a shared graph
  lures the matcher onto the wrong rails.
* Metro shapes are tunnel approximations: mean matching error is 19–26 m on
  L1/L2/L6 against 2–5 m on the surface network.
* **EAV's rail half ships no shapes and no direction_id** — stop sequences are
  the matching observations (pseudo-matching) and headsigns split the
  directions. EAV's regional buses are not drawn: they run out to Benevento,
  far outside the road graph. Keys map the operator's dotted branch numbers
  to letters: `1` → E1, `1.` → E1a, `1..` → E1b.

## Pipeline

`npm run download` fetches the ANM feed, OSM roadways, rails and the name
dictionary (Overpass, bbox 40.72–40.99 N / 14.07–14.50 E) and MapLibre GL.
`npm run build` map-matches every line (HMM/Viterbi on the OSM graphs) and
writes GeoJSON to `data/out/`. `npm run serve` hosts the map at
http://localhost:8140.

Data: ANM (Azienda Napoletana Mobilità) · base map © OpenFreeMap /
OpenMapTiles / OpenStreetMap contributors.
