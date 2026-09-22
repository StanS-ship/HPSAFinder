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
    return div.innerHTML;
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

    const result = JSON.parse(raw);

    if (result.status === 'geocode_failed') {
      root.innerHTML = `
        <div class="card">
          <h2>We couldn't locate that address</h2>
          <div class="error-box">${escapeHtml(result.message)}</div>
          <a class="btn-secondary" href="calculator.html">Try again</a>
        </div>`;
      return;
    }

    if (result.status === 'not_in_hpsa') {
      root.innerHTML = `
        <div class="card">
          <h2>${escapeHtml(result.message)}</h2>
          <p>The address matched to <strong>${escapeHtml(result.geocode.matchedAddress)}</strong> (geocoded via ${escapeHtml(result.geocode.source)}) does not fall within an active, geographic ${escapeHtml(labelForDiscipline(result.hpsa.discipline))} HPSA.</p>
          <p>No CMS bonus applies for services furnished at this location under the selected specialty.</p>
          <a class="btn-secondary" href="calculator.html">Run another estimate</a>
        </div>
        ${renderMuaCard(result.mua)}
        ${nonAffiliationDisclaimer()}`;
      return;
    }

    if (result.status === 'eligible') {
      const { bonus, hpsa, geocode } = result;
      const feature = hpsa.eligibleFeatures[0];

      root.innerHTML = `
        <div class="card">
          <h2>This location is in a designated HPSA</h2>
          <p>Matched address: <strong>${escapeHtml(geocode.matchedAddress)}</strong> (geocoded via ${escapeHtml(geocode.source)}, ${escapeHtml(geocode.confidence)} confidence)</p>

          ${hpsa.bothDisciplines ? `<div class="notice-box">CMS pays only one 10% bonus per service even if the area is both a primary-care and mental-health HPSA.</div>` : ''}

          <div class="result-figure">
            <div class="result-figure__item">
              <span class="result-figure__value">${money(bonus.annualBonus)}</span>
              <span class="result-figure__label">Estimated annual bonus</span>
            </div>
            <div class="result-figure__item">
              <span class="result-figure__value">${money(bonus.quarterlyBonus)}</span>
              <span class="result-figure__label">Estimated quarterly payment</span>
            </div>
          </div>

          <p style="font-size:0.85rem;color:var(--ink-soft)">
            Based on ${money(bonus.adjustedPaidAmount)} in estimated annual Medicare-paid amount
            ${bonus.paymentFactorUsed !== 1 ? `(after applying your ${bonus.paymentFactorUsed}× payment-factor adjustment) ` : ''}
            at the CMS HPSA bonus rate of ${(bonus.bonusRate * 100).toFixed(0)}%.
          </p>
        </div>

        <div class="card">
          <h2>Shortage-area details</h2>
          <dl class="attr-list">
            <dt>Designation type</dt><dd>${escapeHtml(feature.hpsa_typ_desc)}</dd>
            <dt>HPSA score</dt><dd>${escapeHtml(feature.hpsa_score)}</dd>
            <dt>Status</dt><dd>${escapeHtml(feature.hpsa_status_desc)}</dd>
            <dt>Rural/urban status</dt><dd>${escapeHtml(feature.rural_status_desc)}</dd>
            <dt>Discipline</dt><dd>${escapeHtml(feature.discipline_class_desc)}</dd>
            <dt>Designation date</dt><dd>${formatDate(feature.designation_dt)}</dd>
            <dt>State</dt><dd>${escapeHtml(feature.primary_state_nm)}</dd>
          </dl>
        </div>

        ${renderMuaCard(result.mua)}

        <div class="card">
          <div class="disclaimer">${escapeHtml(result.disclaimers.fullPartialCounty)}</div>
          ${nonAffiliationDisclaimer(true)}
        </div>`;
      return;
    }

    root.innerHTML = `<div class="card"><div class="error-box">Unexpected result. Please try again.</div></div>`;
  }

  function renderMuaCard(mua) {
    if (!mua) return '';

    if (mua.error) {
      return `
        <div class="card">
          <h2>Medically Underserved Area/Population (MUA/MUP) status</h2>
          <div class="notice-box">We couldn't check MUA/MUP status for this location right now. This does not affect the HPSA bonus estimate above.</div>
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

  function formatDate(value) {
    if (!value) return '—';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('en-US');
  }

  function nonAffiliationDisclaimer(bare) {
    const text =
      "This calculator is an independent tool and is not affiliated with or endorsed by HRSA or CMS. Bonus eligibility and payment are determined solely by CMS based on official Medicare rules and HRSA's shortage-area designations. Always verify your eligibility and exact bonus amounts using official CMS and HRSA resources before making billing or contractual decisions.";
    return bare ? `<div class="disclaimer">${escapeHtml(text)}</div>` : `<div class="card"><div class="disclaimer">${escapeHtml(text)}</div></div>`;
  }

  render();
})();
