# HRSA Shortage-Area Tools

Two standalone, portable web tools built from a technical research brief
that verified HRSA's live GIS schemas (layer IDs, field names) rather than
assuming them:

1. **HPSA Bonus Estimator** — estimates the CMS 10% Medicare bonus for
   practicing in a designated Health Professional Shortage Area.
2. **J-1 Visa Waiver Eligibility Check** — checks whether a practice
   location meets the federal HPSA/MUA baseline most state Conrad 30 J-1
   visa waiver programs require as a starting point.

A landing page (`public/index.html`) lets the person pick which tool they
need — the two have different inputs, different outputs (a dollar
estimate vs. an eligibility flag), and different disclaimers, so they're
built as separate forms/results pages rather than one combined form.

**Both tools are independent reference tools. Neither is affiliated with
or endorsed by HRSA, CMS, or any state health department**, and neither
replaces verifying results with official resources — CMS/HRSA for the
bonus estimate, and your state's Primary Care Office (plus an immigration
attorney) for the J-1 waiver check.

## How the HPSA Bonus Estimator works

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

## How the J-1 Visa Waiver Eligibility Check works

The J-1 (Conrad 30) baseline requirement is different from the Medicare
bonus rule: it's satisfied by **either** an HPSA of any discipline **or**
an MUA/MUP designation (not just geographic primary-care HPSA), and it
doesn't depend on specialty for the baseline check. `checkJ1Eligibility()`
in `src/api/handler.js`:

1. Geocodes the address (same Census/Google module as the bonus estimator).
2. Queries **all three** HPSA layers via `queryAllHpsaDisciplines()`
   (`src/hpsa/query.js`) plus the MUA/MUP layer, and treats the location
   as meeting the baseline if any of them is active
   (`src/j1/eligibility.js`).
3. Flags whether the highest active HPSA score also meets the separate,
   unlimited-slot federal HHS J-1 Visa Waiver Program's threshold of 7+
   (`HHS_J1_PROGRAM_MIN_HPSA_SCORE` in `src/config/hrsaConfig.js`) —
   verified against multiple state Primary Care Office program manuals.
4. Resolves a state name (from the geocoder's own address components,
   falling back to the HPSA/MUA feature data) and attaches a link to
   HRSA's own live-maintained directory of state Primary Care Offices
   (`HRSA_STATE_PCO_DIRECTORY_URL`) — used instead of hardcoding 50
   individual state program URLs, which would go stale without ongoing
   maintenance this project doesn't attempt to promise.

**Deliberate scope limit:** this checker does **not** attempt to encode
each state's specific Conrad 30 rules (score cutoffs for certain
specialties, Medicaid patient-volume percentages, specialty priority, or
current slot availability). Those rules vary by state, change annually,
and aren't available through any live, structured API the way HPSA/MUA
data is — see `J1_STATE_VARIATION_CAVEAT` in
`src/consent/disclaimerText.js` for the exact copy shown to users about
this, and the "Known limitations" section below for the reasoning.

### Results page layout (a deliberate design choice)

The J-1 results page (`public/j1-results.html` /
`public/js/j1-results.js`) orders content as: (1) the eligibility
finding, (2) an employer/agency referral call-to-action with the TCPA
consent checkbox, (3) HPSA score / MUA details, (4) the state Primary
Care Office directory link, (5) disclaimers. The referral CTA is placed
above the outbound state link — both are shown, honestly and without
hiding either, but the monetized next-step gets primary visual placement
since it's a genuinely relevant next step for someone who just learned
their location qualifies. See `REFERRAL_FEE_DISCLOSURE` in
`src/consent/disclaimerText.js` for the disclosure shown alongside it.

## Project structure

```
.
├── src/
│   ├── config/
│   │   ├── hrsaConfig.js           # layer IDs, endpoints, rates, J-1 score threshold, HRSA PCO directory URL
│   │   └── statesConfig.js         # static US state FIPS/name/abbreviation reference table
│   ├── geocoding/
│   │   ├── census.js               # primary geocoder (also returns state abbreviation)
│   │   ├── google.js               # fallback geocoder (also returns state abbreviation)
│   │   └── index.js                # Census-first, Google-fallback orchestration
│   ├── hpsa/query.js               # HPSA MapServer point-in-polygon query + eligibility filters
│   ├── mua/query.js                # MUA/MUP MapServer lookup (informational, no bonus)
│   ├── bonus/calculate.js          # CMS 10% bonus math
│   ├── j1/eligibility.js           # J-1 baseline check (HPSA any-discipline OR MUA/MUP + HHS score threshold)
│   ├── consent/disclaimerText.js   # verbatim consent + disclaimer copy (Section 6) + J-1 notes
│   └── api/handler.js              # portable controllers: calculateHpsaBonus() and checkJ1Eligibility()
├── public/                         # multi-page static frontend (not an SPA)
│   ├── index.html                  # landing page — choose bonus estimator or J-1 checker
│   ├── calculator.html             # Medicare bonus calculator form
│   ├── bonus-results.html          # Medicare bonus results page
│   ├── j1-checker.html             # J-1 waiver checker form
│   ├── j1-results.html             # J-1 waiver results page
│   ├── css/styles.css              # navy / teal / off-white design tokens
│   └── js/{app,results,j1-app,j1-results}.js
├── tests/                          # unit tests for logic that needs no network (bonus math,
│                                   # HPSA/MUA eligibility filtering, disclaimer text, state FIPS lookup)
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
3. Wire `calculateHpsaBonus()` and `checkJ1Eligibility()` from
   `src/api/handler.js` into whatever backend/routing layer Bolt.new's
   target stack uses — both are plain `async` functions, so they drop
   into Express routes, serverless functions, or any other adapter with a
   few lines of glue code each.
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
- **The J-1 checker deliberately does not encode individual state Conrad
  30 rules** (score cutoffs for certain specialties, Medicaid
  patient-volume percentages, specialty priority, current slot
  availability). This isn't an oversight — those rules live in 50+
  separate, non-API'd PDF policy manuals that are each revised annually,
  and slot availability changes operationally throughout the year with no
  live feed to check it against. Encoding a static snapshot of "50 states'
  rules as of [date]" would go stale within a year and risk giving
  false confidence on an immigration-consequential decision. Instead, the
  checker verifies the one federal-level constant that IS stable (the
  HHS program's HPSA score >= 7 threshold) and routes everything
  state-specific to HRSA's own live-maintained Primary Care Office
  directory. If a future maintainer wants to build a static 50-state
  summary table instead, budget real one-time research effort per state
  plus a recurring annual re-verification pass — see the design
  discussion referenced in this project's history for the tradeoffs.
- **The "payment factor" is a planning estimate**, not an official CMS
  multiplier — it is intentionally exposed as a configurable input, never
  hardcoded as if it were authoritative.
- **Lead-capture consent (Section 6.1)** appears on both the bonus
  calculator and the J-1 checker (`public/calculator.html` and
  `public/j1-checker.html`, plus the referral CTA on
  `public/j1-results.html`), each rendering one checkbox with a
  placeholder `[Agency/Hospital Name]`. A production deployment should
  render one checkbox per real named seller and persist the exact
  consent text, a timestamp, the submitting IP address, and which boxes
  were checked — the IP capture must happen server-side. The "See
  employers hiring near me" button on the J-1 results page is currently a
  placeholder (`alert(...)` in `public/js/j1-results.js`) pending an
  actual referral/employer-listing integration.

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
# HPSAFinder
# HPSAFinder
# HPSAFinder
# HPSAFinder
