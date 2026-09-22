/**
 * Calculator page controller. Submits the form to the backend
 * /api/calculate endpoint (see server.js / src/api/handler.js), stashes
 * the result in sessionStorage, and navigates to results.html — this
 * keeps the app a true multi-page site (full navigation between pages)
 * rather than a single-page app.
 */
(function () {
  const form = document.getElementById('calculator-form');
  const submitBtn = document.getElementById('submit-btn');
  const errorBox = document.getElementById('form-error');

  function showError(message) {
    errorBox.textContent = message;
    errorBox.hidden = false;
  }

  function clearError() {
    errorBox.hidden = true;
    errorBox.textContent = '';
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearError();

    const formData = new FormData(form);
    const address = formData.get('address')?.toString().trim();
    const specialty = formData.get('specialty')?.toString();
    const annualPaidAmountRaw = formData.get('annualPaidAmount')?.toString();
    const paymentFactorRaw = formData.get('paymentFactor')?.toString();
    const consentAgency = formData.get('consentAgency') === 'on';

    if (!address) {
      showError('Please enter a practice address.');
      return;
    }

    const annualPaidAmount = Number(annualPaidAmountRaw);
    if (!annualPaidAmountRaw || Number.isNaN(annualPaidAmount) || annualPaidAmount < 0) {
      showError('Please enter a valid, non-negative estimated Medicare-paid amount.');
      return;
    }

    let paymentFactor;
    if (paymentFactorRaw) {
      paymentFactor = Number(paymentFactorRaw);
      if (Number.isNaN(paymentFactor) || paymentFactor <= 0) {
        showError('Payment-factor adjustment must be a positive number, if provided.');
        return;
      }
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Checking…';

    // If the user consented, record it locally with the exact text shown,
    // a timestamp, and which box was checked (Section 6.1). IP address
    // capture must happen server-side; the reference server does not log
    // it, but a production deployment should record it at the API layer
    // alongside this consent record.
    if (consentAgency) {
      const consentRecord = {
        agency: '[Agency/Hospital Name]',
        consentText: document.querySelector('.checkbox-row p').textContent.trim(),
        timestamp: new Date().toISOString(),
        checked: true,
      };
      sessionStorage.setItem('hpsa_consent_record', JSON.stringify(consentRecord));
    }

    try {
      const res = await fetch('/api/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, specialty, annualPaidAmount, paymentFactor }),
      });

      const result = await res.json();

      if (!res.ok) {
        showError(result.error || 'Something went wrong. Please try again.');
        return;
      }

      sessionStorage.setItem('hpsa_result', JSON.stringify(result));
      window.location.href = 'bonus-results.html';
    } catch (err) {
      showError('Could not reach the calculator service. Please check your connection and try again.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Estimate my bonus';
    }
  });
})();
