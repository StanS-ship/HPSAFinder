/**
 * Results page renderer. Reads the result stashed by app.js in
 * sessionStorage and renders the appropriate view: geocode failure,
 * not-in-HPSA, or eligible-with-bonus-estimate (Section 5.5).
 */
(function () {
  const root = document.getElementById('results-root');

  const money = (n) =>
    n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str ?? '';
    // textContent -> innerHTML encodes & < >, but leaves quotes intact, which
    // is unsafe inside an attribute. Encode them explicitly.
    return div.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function render() {
    const raw = sessionStorage.getItem('hpsa_result');
    if (!raw) {
      root.innerHTML = `
        <div class="card">
          <div class="notice-box">No results found. Please run the calculator first.</div>
          <a class="btn-secondary" href="calculator.html">Go to calculator</a>
        </div>`;
      return;
    }

    let result;
    try {
      result = JSON.parse(raw);
    } catch {
      root.innerHTML = `
        <div class="card">
          <div class="error-box">These results could not be opened. Please run the calculator again.</div>
          <a class="btn-secondary" href="calculator.html">Go to calculator</a>
        </div>`;
      return;
    }

    if (result.status === 'geocode_failed' || result.status === 'hpsa_query_failed') {
      root.innerHTML = `
        <div class="card">
          <h2>${result.status === 'hpsa_query_failed' ? 'We could not complete the HPSA check' : "We couldn't locate that address"}</h2>
          <div class="${result.status === 'hpsa_query_failed' ? 'notice-box' : 'error-box'}">${escapeHtml(result.message)}</div>
          ${result.geocode ? `<p>Address matched to <strong>${escapeHtml(result.geocode.matchedAddress)}</strong>.</p>` : ''}
          <a class="btn-secondary" href="calculator.html">Try again</a>
        </div>`;
      return;
    }

    if (result.status === 'not_in_hpsa') {
      root.innerHTML = `
        <div class="card">
          <h2>Not eligible</h2>
          <p>${escapeHtml(result.message)}</p>
          <p>The address matched to <strong>${escapeHtml(result.geocode.matchedAddress)}</strong> (geocoded via ${escapeHtml(result.geocode.source)}, ${escapeHtml(result.geocode.confidence)} confidence) does not fall within an active, geographic ${escapeHtml(labelForDiscipline(result.hpsa.discipline))} HPSA.</p>
          <p>No CMS bonus applies for services furnished at this location under the selected specialty.</p>
          <a class="btn-secondary" href="calculator.html">Run another estimate</a>
        </div>
        ${cmsVerificationCard(result.cmsVerificationNote)}
        ${renderMuaCard(result.mua)}
        ${nonAffiliationDisclaimer()}`;
      return;
    }

    if (result.status === 'eligible') {
      const { bonus, hpsa, geocode, bonusEligibility, cmsVerificationNote } = result;
      const feature = hpsa.eligibleFeatures[0];
      const notYet = bonusEligibility?.classification === 'not_yet_eligible';
      const dateMissing = bonusEligibility?.classification === 'designation_date_missing';
      const cutoffLabel = bonusEligibility?.cutoffDate
        ? new Date(bonusEligibility.cutoffDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
        : null;

      root.innerHTML = `
        <div class="card">
          <h2>${notYet ? 'Designated, but not yet bonus-eligible' : 'Likely eligible'}</h2>
          <p>Matched address: <strong>${escapeHtml(geocode.matchedAddress)}</strong> (geocoded via ${escapeHtml(geocode.source)}, ${escapeHtml(geocode.confidence)} confidence)</p>

          ${notYet ? `<div class="notice-box">CMS uses designations in effect as of ${escapeHtml(cutoffLabel)}. This designation becomes eligible for the bonus starting January 1, ${escapeHtml(String(bonusEligibility.nextYear))}.</div>` : ''}
          ${dateMissing ? `<div class="notice-box">Designation date unavailable. Verify that it was in effect as of ${escapeHtml(cutoffLabel)}.</div>` : ''}
          ${bonus.note ? `<div class="notice-box">${escapeHtml(bonus.note)}</div>` : ''}
          ${geocode.confidence !== 'high' ? `<div class="notice-box">The address match is not exact. Confirm the matched address before relying on this estimate.</div>` : ''}

          ${notYet ? `
          <div class="result-figure">
            <div class="result-figure__item">
              <span class="result-figure__value">${money(bonus.annualBonus)}</span>
              <span class="result-figure__label">Projected next-year estimate (annual)</span>
            </div>
            <div class="result-figure__item">
              <span class="result-figure__value">${money(bonus.quarterlyBonus)}</span>
              <span class="result-figure__label">Projected next-year estimate (approximate quarterly)</span>
            </div>
          </div>
          <p style="font-size:0.85rem;color:var(--muted)">No bonus is payable for the current year. The figures above are a projection only.</p>
          ` : `
          <div class="result-figure">
            <div class="result-figure__item">
              <span class="result-figure__value">${money(bonus.annualBonus)}</span>
              <span class="result-figure__label">Estimated annual bonus</span>
            </div>
            <div class="result-figure__item">
              <span class="result-figure__value">${money(bonus.quarterlyBonus)}</span>
              <span class="result-figure__label">Approximate quarterly payment</span>
            </div>
          </div>
          `}

          <p style="font-size:0.85rem;color:var(--muted)">
            Based on ${money(bonus.adjustedPaidAmount)} in estimated annual Medicare-paid amount
            ${bonus.paidToAllowedRatioUsed !== 1 ? `(after applying your ${bonus.paidToAllowedRatioUsed}× paid-to-allowed ratio) ` : ''}
            at the CMS HPSA bonus rate of ${(bonus.bonusRate * 100).toFixed(0)}%.
          </p>
        </div>

        <div class="card">
          <h2>Shortage-area details</h2>
          <dl class="attr-list">
            <dt>Designation type</dt><dd>${escapeHtml(feature.hpsa_typ_desc)}</dd>
            <dt>HPSA score</dt><dd>${escapeHtml(feature.hpsa_score)}${scoreRangeNote(hpsa.discipline)}</dd>
            <dt>Status</dt><dd>${escapeHtml(feature.hpsa_status_desc)}</dd>
            <dt>Rural/urban status</dt><dd>${escapeHtml(feature.rural_status_desc)}</dd>
            <dt>Discipline</dt><dd>${escapeHtml(feature.discipline_class_desc)}</dd>
            <dt>Designation date</dt><dd>${formatDate(feature.designation_dt)}</dd>
            <dt>State</dt><dd>${escapeHtml(feature.primary_state_nm)}</dd>
          </dl>
        </div>

        ${cmsVerificationCard(cmsVerificationNote)}
        ${renderMuaCard(result.mua)}

        <div class="card">
          <div class="disclaimer">${escapeHtml(result.disclaimers.fullPartialCounty)}</div>
          ${nonAffiliationDisclaimer(true)}
        </div>`;
      return;
    }

    root.innerHTML = `<div class="card"><div class="error-box">Unexpected result. Please try again.</div><a class="btn-secondary" href="calculator.html">Go to calculator</a></div>`;
  }

  function renderMuaCard(mua) {
    if (!mua) return '';

    if (mua.error) {
      return `
        <div class="card">
          <h2>Medically Underserved Area/Population (MUA/MUP) status</h2>
          <div class="notice-box">We couldn't check MUA/MUP status for this location right now. This does not affect the HPSA bonus estimate above.</div>
          <div class="disclaimer">${escapeHtml(mua.note)}</div>
        </div>`;
    }

    const activeFeature = mua.activeFeatures?.[0];

    return `
      <div class="card">
        <h2>Medically Underserved Area/Population (MUA/MUP) status</h2>
        ${
          mua.isInMua
            ? `<p>This location <strong>is</strong> within a designated MUA/MUP: <strong>${escapeHtml(activeFeature.service_area_name)}</strong> (${escapeHtml(activeFeature.designation_type_desc)}, ${escapeHtml(activeFeature.service_area_type_desc)}).</p>`
            : `<p>This location is <strong>not</strong> within a currently designated MUA/MUP.</p>`
        }
        <div class="disclaimer">${escapeHtml(mua.note)}</div>
      </div>`;
  }

  function labelForDiscipline(discipline) {
    return { primary_care: 'primary care', mental_health: 'mental health', dental: 'dental' }[discipline] || discipline;
  }

  function scoreRangeNote(discipline) {
    return discipline === 'dental' ? ' (scale 0–26)' : ' (scale 0–25)';
  }

  function cmsVerificationCard(note) {
    if (!note) return '';
    return `
      <div class="card">
        <div class="disclaimer">${escapeHtml(note)}</div>
      </div>`;
  }

  function formatDate(value) {
    if (!value) return '—';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? escapeHtml(String(value)) : d.toLocaleDateString('en-US');
  }

  function nonAffiliationDisclaimer(bare) {
    const text =
      "This calculator is an independent tool and is not affiliated with or endorsed by HRSA or CMS. Bonus eligibility and payment are determined solely by CMS based on official Medicare rules and HRSA's shortage-area designations. Always verify your eligibility and exact bonus amounts using official CMS and HRSA resources before making billing or contractual decisions.";
    return bare ? `<div class="disclaimer">${escapeHtml(text)}</div>` : `<div class="card"><div class="disclaimer">${escapeHtml(text)}</div></div>`;
  }

  render();
})();
