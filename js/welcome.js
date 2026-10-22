const enterLink = document.getElementById('enter-system');
const logoutButton = document.getElementById('logout-system');
const authNote = document.querySelector('.auth-note');
let csrfToken = '';

async function revealLogoutForActiveSession() {
  try {
    const response = await fetch('/api/me', { credentials: 'same-origin' });
    if (!response.ok) return;
    const session = await response.json();
    csrfToken = session.csrfToken || '';
    logoutButton.hidden = !csrfToken;
  } catch {
    // A API indisponível não impede abrir o cartão-postal nem acessar o login.
  }
}

logoutButton?.addEventListener('click', async () => {
  if (!csrfToken) return;
  logoutButton.disabled = true;
  logoutButton.textContent = 'Saindo…';
  try {
    const response = await fetch('/api/logout', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
      body: '{}'
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Não foi possível encerrar a sessão.');
    csrfToken = '';
    logoutButton.hidden = true;
    authNote.textContent = 'Sessão encerrada. Use “Entrar no sistema” para acessar novamente.';
  } catch (error) {
    authNote.textContent = error.message;
    logoutButton.textContent = 'Sair';
    logoutButton.disabled = false;
  }
});

revealLogoutForActiveSession();

enterLink?.addEventListener('click', event => {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  if (enterLink.getAttribute('aria-busy') === 'true') return;
  enterLink.setAttribute('aria-busy', 'true');
  enterLink.querySelector('span').textContent = 'Abrindo sistema…';
  window.setTimeout(() => window.location.assign(enterLink.href), 140);
});
