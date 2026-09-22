/**
 * J-1 checker page controller. Mirrors app.js's pattern (submit to
 * backend, stash result in sessionStorage, navigate to a dedicated
 * results page) to keep this a true multi-page site.
 */
(function () {
  const form = document.getElementById('j1-form');
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
    const consentAgency = formData.get('consentAgency') === 'on';

    if (!address) {
      showError('Please enter a practice address.');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Checking…';

    if (consentAgency) {
      const consentRecord = {
        agency: '[Agency/Hospital Name]',
        consentText: document.querySelector('.checkbox-row p').textContent.trim(),
        timestamp: new Date().toISOString(),
        checked: true,
      };
      sessionStorage.setItem('j1_consent_record', JSON.stringify(consentRecord));
    }

    try {
      const res = await fetch('/api/j1-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
      });

      const result = await res.json();

      if (!res.ok) {
        showError(result.error || 'Something went wrong. Please try again.');
        return;
      }

      sessionStorage.setItem('j1_result', JSON.stringify(result));
      window.location.href = 'j1-results.html';
    } catch (err) {
      showError('Could not reach the checker service. Please check your connection and try again.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Check this location';
    }
  });
})();
