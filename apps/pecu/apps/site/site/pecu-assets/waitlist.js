const form = document.querySelector('.waitlist-form');
if (form) {
  const email = form.elements.namedItem('email');
  const consent = form.elements.namedItem('consent');
  const button = form.querySelector('button[type="submit"]');
  const status = form.querySelector('.waitlist-status');
  const idleLabel = button.textContent;
  const show = (message, state) => {
    status.textContent = message;
    status.dataset.state = state;
  };
  const clear = (field) => field.addEventListener('input', () => {
    field.removeAttribute('aria-invalid');
    if (status.dataset.state === 'error') show('', '');
  });
  clear(email);
  clear(consent);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (form.dataset.busy) return;
    const address = email.value.trim();
    const valid = Boolean(address) && email.checkValidity();
    for (const [field, invalid] of [[email, !valid], [consent, valid && !consent.checked]]) {
      if (invalid) field.setAttribute('aria-invalid', 'true');
      else field.removeAttribute('aria-invalid');
    }
    if (!valid) {
      show('Enter a full email address, like name@example.com.', 'error');
      email.focus();
      return;
    }
    if (!consent.checked) {
      show('Tick the box so Pecu can email you about the launch.', 'error');
      consent.focus();
      return;
    }
    form.dataset.busy = 'true';
    button.disabled = true;
    button.textContent = 'Joining…';
    show('', '');
    try {
      const response = await fetch('/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: address, consent: true }),
      });
      const result = await response.json().catch(() => ({}));
      const field = response.status === 400 ? form.elements.namedItem(result.field) : null;
      if (field) field.setAttribute('aria-invalid', 'true');
      if (!response.ok) throw new Error(response.status === 429 || field ? result.error : '');
      form.classList.add('is-joined');
      for (const field of [email, consent, button]) field.disabled = true;
      button.textContent = 'Joined';
      show('You\'re on the list. Pecu will email you when it launches.', 'success');
    } catch (error) {
      button.disabled = false;
      button.textContent = idleLabel;
      show(error instanceof Error && error.message ? error.message : 'Your email wasn\'t saved. Check your connection and try again.', 'error');
      form.querySelector('[aria-invalid="true"]')?.focus();
    } finally {
      delete form.dataset.busy;
    }
  });
}
