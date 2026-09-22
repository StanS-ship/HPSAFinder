/**
 * J-1 results page renderer. Layout order (agreed design):
 *   1. Eligibility finding
 *   2. Referral/agency CTA with consent (primary next-step, when eligible)
 *   3. HPSA score / MUA details
 *   4. State PCO directory link (secondary placement, still present)
 *   5. Disclaimers
 */
(function () {
  const root = document.getElementById('results-root');

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str ?? '';
    return div.innerHTML;
  }

  function render() {
    const raw = sessionStorage.getItem('j1_result');
    if (!raw) {
      root.innerHTML = `
        <div class="card">
          <div class="notice-box">No results found. Please run the checker first.</div>
          <a class="btn-secondary" href="j1-checker.html">Go to checker</a>
        </div>`;
      return;
    }

    const result = JSON.parse(raw);

    if (result.status === 'geocode_failed') {
      root.innerHTML = `
        <div class="card">
          <h2>We couldn't locate that address</h2>
          <div class="error-box">${escapeHtml(result.message)}</div>
          <a class="btn-secondary" href="j1-checker.html">Try again</a>
        </div>`;
      return;
    }

    const { j1, geocode } = result;
    const stateLabel = j1.state?.name || j1.state?.abbr || 'this state';

    // 1. Eligibility finding
    let html = `
      <div class="card">
        <h2>${j1.meetsBaseline ? 'This location meets the federal shortage-area baseline' : 'This location does not meet the federal shortage-area baseline'}</h2>
        <p>Matched address: <strong>${escapeHtml(geocode.matchedAddress)}</strong> (geocoded via ${escapeHtml(geocode.source)})</p>
        <div class="${j1.meetsBaseline ? 'notice-box' : 'error-box'}">${escapeHtml(j1.baselineNote)}</div>
        ${j1.meetsHhsProgramThreshold ? `<div class="notice-box">${escapeHtml(j1.hhsProgramNote)}</div>` : ''}
      </div>`;

    // 2. Referral/agency CTA with consent — primary next step, only when eligible
    if (j1.meetsBaseline) {
      html += `
      <div class="card">
        <h2>Connect with employers hiring in this area</h2>
        <p>Physicians and psychiatrists are in demand at facilities in HPSA/MUA areas that sponsor J-1 waivers. See employers actively hiring in ${escapeHtml(stateLabel)}.</p>
        <fieldset>
          <legend>Contact consent (optional)</legend>
          <div class="checkbox-row">
            <input type="checkbox" id="consent-agency-results" />
            <p>By checking this box, I agree that <strong>[Agency/Hospital Name]</strong> may contact me at the phone number and email I provide with information about physician and advanced-practice job opportunities, including positions that sponsor J-1 visa waivers. Contact may include calls or text messages using an automatic telephone dialing system or prerecorded/artificial voice. I understand that I am <strong>not required to consent</strong> as a condition of using this checker or any services, and I can opt out at any time.</p>
          </div>
        </fieldset>
        <button type="button" class="btn-primary" id="see-employers-btn">See employers hiring near me</button>
        <p class="field__hint" style="margin-top:0.75rem;">Some links here go to organizations we partner with. We may receive a referral fee or commission if you connect with them or accept a position.</p>
      </div>`;
    }

    // 3. HPSA score / MUA details
    const activeHpsa = (j1.hpsaByDiscipline || []).filter((d) => d.eligibleFeatures?.length > 0);
    html += `
      <div class="card">
        <h2>Shortage-area details</h2>
        ${
          activeHpsa.length > 0
            ? activeHpsa
                .map((d) => {
                  const f = d.eligibleFeatures[0];
                  return `<dl class="attr-list" style="margin-bottom:0.75rem;">
                    <dt>Discipline</dt><dd>${escapeHtml(labelForDiscipline(d.discipline))}</dd>
                    <dt>HPSA score</dt><dd>${escapeHtml(f.hpsa_score)}</dd>
                    <dt>Status</dt><dd>${escapeHtml(f.hpsa_status_desc)}</dd>
                  </dl>`;
                })
                .join('')
            : '<p>No active HPSA designation at this location.</p>'
        }
        ${
          j1.mua?.isInMua
            ? `<p>Also within a designated MUA/MUP: <strong>${escapeHtml(j1.mua.activeFeatures[0]?.service_area_name)}</strong> (${escapeHtml(j1.mua.activeFeatures[0]?.designation_type_desc)}).</p>`
            : '<p>Not within a currently designated MUA/MUP.</p>'
        }
      </div>`;

    // 4. State PCO directory link — secondary placement, still present
    html += `
      <div class="card">
        <p>To confirm ${escapeHtml(stateLabel)}'s specific Conrad 30 requirements and current slot availability, contact that state's Primary Care Office:</p>
        <a href="${j1.statePcoDirectoryUrl}" target="_blank" rel="noopener">Find ${escapeHtml(stateLabel)}'s Primary Care Office (HRSA directory) &rarr;</a>
      </div>`;

    // 5. Disclaimers
    html += `
      <div class="card">
        <div class="disclaimer">${escapeHtml(j1.stateVariationCaveat)}</div>
        <div class="disclaimer">This checker is an independent tool and is not affiliated with or endorsed by HRSA, CMS, or any state health department. It does not provide immigration advice. Consult an immigration attorney for guidance specific to your situation.</div>
      </div>`;

    root.innerHTML = html;

    const seeEmployersBtn = document.getElementById('see-employers-btn');
    if (seeEmployersBtn) {
      seeEmployersBtn.addEventListener('click', () => {
        const consentBox = document.getElementById('consent-agency-results');
        if (consentBox?.checked) {
          const consentRecord = {
            agency: '[Agency/Hospital Name]',
            consentText: document.querySelector('#consent-agency-results + p').textContent.trim(),
            timestamp: new Date().toISOString(),
            checked: true,
          };
          sessionStorage.setItem('j1_consent_record', JSON.stringify(consentRecord));
        }
        // Placeholder: wire this to the actual employer/agency referral
        // destination once a specific partner integration is chosen.
        alert('This would connect to partner employer listings once a referral integration is configured.');
      });
    }
  }

  function labelForDiscipline(discipline) {
    return { primary_care: 'Primary care', mental_health: 'Mental health', dental: 'Dental' }[discipline] || discipline;
  }

  render();
})();
