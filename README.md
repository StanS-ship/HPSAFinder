# HPSA Bonus Estimator

A standalone, portable web app that estimates the CMS 10% Medicare HPSA
(Health Professional Shortage Area) bonus for a given practice address and
specialty. Built from a technical research brief that verified HRSA's
live MapServer schema (layer IDs, field names) rather than assuming them.

**This tool is an independent reference calculator. It is not affiliated
with or endorsed by HRSA or CMS**, and it does not replace verifying
eligibility and exact bonus amounts with your MAC or official CMS/HRSA
resources.

## How it works

1. **Geocode** the practice address (`src/geocoding/`) — U.S. Census
   Bureau geocoder first (free, no key), Google Geocoding API as a paid
   fallback if Census fails or returns a low-confidence match.
2. **Spatial query** (`src/hpsa/`) — sends the resulting lat/long to the
   correct HRSA HPSA GIS MapServer "perimeter polygon" layer for the
   selected specialty (no API key/token required — it's a public,
   read-only ArcGIS REST service):
   - Layer `10` — Primary Care HPSA
   - Layer `6` — Mental Health HPSA (psychiatrists)
   - Layer `2` — Dental Health HPSA
3. **MUA/MUP lookup** (`src/mua/`) — separately queries HRSA's
   `MedicallyUnderservedAreas_FS` MapServer (Layer `0`) for the same
   coordinates. **This is informational only.** Unlike an HPSA
   designation, MUA/MUP status does not trigger the CMS 10% bonus — it
   matters for other things (FQHC/Section 330 eligibility, Rural Health
   Clinic eligibility, National Health Service Corps site eligibility).
   It runs on every search regardless of specialty and never feeds into
   the bonus math.
4. **Bonus calculation** (`src/bonus/`) — applies the CMS 10% bonus rate
   to the estimated annual Medicare-paid amount, split into an annual and
   quarterly figure. The "payment factor" (allowed-charge-to-paid-amount
   ratio) is a **user-configurable estimate**, never a hardcoded CMS
   constant — see the note in `src/config/hrsaConfig.js`.
5. **Disclaimers & consent copy** (`src/consent/`) — verbatim TCPA/FTC
   consent language and the HRSA/CMS non-affiliation disclaimer, kept in
   one file so legal copy only needs to be edited in one place.

The full pipeline is orchestrated by the single, framework-agnostic
`calculateHpsaBonus()` function in `src/api/handler.js`. It takes a plain
object in and returns a plain object out — no dependency on Express, a
particular serverless runtime, or any specific hosting platform, so it
can be wired into Bolt.new (or anything else) with a thin adapter.

## Project structure

```
.
├── src/
│   ├── config/hrsaConfig.js       # single source of truth for layer IDs, endpoints, rates
│   ├── geocoding/
│   │   ├── census.js              # primary geocoder
│   │   ├── google.js              # fallback geocoder
│   │   └── index.js               # Census-first, Google-fallback orchestration
│   ├── hpsa/query.js               # HPSA MapServer point-in-polygon query + eligibility filters
│   ├── mua/query.js                # MUA/MUP MapServer lookup (informational, no bonus)
│   ├── bonus/calculate.js          # CMS 10% bonus math
│   ├── consent/disclaimerText.js   # verbatim consent + disclaimer copy (Section 6)
│   └── api/handler.js              # portable controller tying the above together
├── public/                         # multi-page static frontend (not an SPA)
│   ├── index.html                  # calculator form
│   ├── results.html                # results page
│   ├── css/styles.css              # navy / teal / off-white design tokens
│   └── js/{app.js,results.js}      # form handling + results rendering
├── tests/                          # unit tests for logic that needs no network (bonus math,
│                                   # HPSA eligibility filtering, verbatim disclaimer text)
├── server.js                       # OPTIONAL local reference server (plain Node http, no framework)
├── .env.example                    # placeholder env values — copy to .env and fill in real ones
└── .gitignore                      # excludes .env and other local/build artifacts
```

## Setup

1. Install Node.js 18+ (uses the native `fetch` API — no HTTP client
   dependency).
2. Copy the environment template and fill in real values:
   ```bash
   cp .env.example .env
   ```
   - `GOOGLE_GEOCODING_API_KEY` — only needed if you want the Google
     fallback geocoder to actually run (Census alone works with no key).
   - `CENSUS_BENCHMARK` — defaults to `Public_AR_Current`; the app also
     reconfirms this against Census's live `/geocoder/benchmarks`
     endpoint at request time and logs a warning if it's stale.
   - `DEFAULT_PAYMENT_FACTOR` — defaults to `1.0` (no adjustment).
3. Run the optional local reference server:
   ```bash
   npm start
   ```
   Then open `http://localhost:3000`.
4. Run the unit tests (no network required — they only exercise pure
   logic: bonus math, HPSA eligibility filtering, and the verbatim
   disclaimer text):
   ```bash
   npm test
   ```

## Importing into Bolt.new

This project has no Bolt-specific code and no bundler config baked in.
To bring it into a Bolt.new project:

1. Push this repo to GitHub (see commands below).
2. In Bolt.new, import from GitHub using the repo URL.
3. Wire `calculateHpsaBonus()` from `src/api/handler.js` into whatever
   backend/routing layer Bolt.new's target stack uses — it's a plain
   `async` function, so it drops into an Express route, a serverless
   function, or any other adapter with a few lines of glue code.
4. Reuse `public/` as-is, or adapt its markup/CSS into Bolt's component
   structure — the design tokens live in `public/css/styles.css`.

## Known limitations / Phase 2 items (flagged in the brief)

- **Full- vs. partial-county determination is out of scope for this MVP.**
  HRSA's perimeter-polygon layers do not expose a full-county boolean
  field. Instead of guessing, the app shows a disclaimer pointing users to
  their MAC or CMS's published bonus ZIP list. See
  `FULL_PARTIAL_COUNTY_DISCLAIMER` in `src/consent/disclaimerText.js`.
- **Exact string values for `HPSA_TYP_DESC` / `HPSA_POPULATION_TYP_CD`
  should be periodically re-sampled** from the live MapServer — HRSA has
  not published these as a fixed enum contract. `isGeographicHpsa()` and
  `isCurrentlyDesignated()` in `src/hpsa/query.js` are the two places to
  update if HRSA changes these values.
- **The MUA/MUP `STATUS_DESCRIPTION` eligible value ("Designated") is an
  assumption**, not a confirmed live sample — it mirrors the HPSA
  convention since both come from HRSA's shared Shortage Designation
  Management System, but should be verified against a real MUA/MUP query
  response before relying on it. See the note in
  `isCurrentlyDesignatedMua()` in `src/mua/query.js`.
- **The "payment factor" is a planning estimate**, not an official CMS
  multiplier — it is intentionally exposed as a configurable input, never
  hardcoded as if it were authoritative.
- **Lead-capture consent (Section 6.1)** in this build renders one
  checkbox with a placeholder `[Agency/Hospital Name]`. A production
  deployment should render one checkbox per real named seller and persist
  the exact consent text, a timestamp, the submitting IP address, and
  which boxes were checked — the IP capture must happen server-side.

## Pushing to GitHub

This repo is already initialized locally with incremental commits. To
push it to a new GitHub repository:

```bash
# 1. Create a new, empty repository on GitHub first (no README/license/
#    .gitignore — this repo already has all three), then:
git remote add origin https://github.com/<your-username>/<your-repo-name>.git
git branch -M main
git push -u origin main
```

If you created the GitHub repo via the `gh` CLI instead:

```bash
gh repo create <your-repo-name> --private --source=. --remote=origin --push
```
