const root = document.getElementById('portal');
const initialDepartments = ['Administração', 'Assistência Social', 'Educação', 'Finanças', 'Meio Ambiente', 'Obras e Serviços Urbanos', 'Saúde', 'Transportes'];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let csrf = '';

async function api(path, options = {}) {
  const headers = {'Content-Type': 'application/json', ...(options.headers || {})};
  if (options.method && options.method !== 'GET' && csrf) headers['X-CSRF-Token'] = csrf;
  const response = await fetch('/api' + path, {credentials: 'same-origin', ...options, headers});
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Falha HTTP ' + response.status);
  return data;
}

function layout(title, content) {
  root.innerHTML = '<div class="login-wrap"><section class="login-card"><div class="brand"><div class="brand-mark">S</div><div><h1>SIGAM</h1><p>Sistema Integrado de Gestão e Administração Municipal</p></div></div><h2>' + title + '</h2>' + content + '<nav class="form-navigation" aria-label="Navegação SIGAM"><a href="/" class="button nav-button">← Voltar ao SIGAM</a></nav></section></div>';
}

function showError(message) {
  layout('SIGAM indisponível', '<p>' + esc(message) + '</p><p>Confira se o servidor está ativo e tente novamente.</p><button class="button button-primary" id="try-again">Tentar novamente</button>');
  document.getElementById('try-again').onclick = init;
}

function showLogin(error = '') {
  layout('Entrar no sistema', '<form id="login-form"><p>Acesse com seu usuário ou e-mail e senha da conta municipal.</p><div class="field"><label for="username">Usuário ou e-mail</label><input class="control" id="username" name="username" autocomplete="username" required></div><div class="field"><label for="password">Senha</label><input class="control" id="password" name="password" type="password" autocomplete="current-password" required></div><p class="form-error" id="login-error" role="alert">' + esc(error) + '</p><button class="button button-primary" type="submit" style="width:100%">Entrar</button></form>');
  document.getElementById('login-form').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    try {
      const session = await api('/login', {method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form)))});
      csrf = session.csrfToken;
      window.location.assign('/produtividade.html');
    } catch (err) {
      document.getElementById('login-error').textContent = err.message;
      button.disabled = false;
    }
  });
}

function showSetup() {
  layout('Configurar administrador inicial', '<p>Este cadastro funciona uma única vez nesta instalação. Guarde a senha escolhida.</p><form id="setup-form"><div class="field"><label for="setup-user">Usuário administrador</label><input class="control" id="setup-user" name="username" maxlength="80" required></div><div class="field"><label for="setup-name">Nome completo</label><input class="control" id="setup-name" name="name" maxlength="180" required></div><div class="field"><label for="setup-pass">Senha (mínimo 12 caracteres)</label><input class="control" id="setup-pass" name="password" type="password" minlength="12" autocomplete="new-password" required></div><div class="field"><label for="setup-confirm">Confirmar senha</label><input class="control" id="setup-confirm" type="password" minlength="12" autocomplete="new-password" required></div><div class="field"><label for="setup-departments">Secretarias iniciais, uma por linha</label><textarea class="control" id="setup-departments" rows="5" required>' + initialDepartments.join('\n') + '</textarea></div><p class="form-error" id="setup-error" role="alert"></p><button class="button button-primary" type="submit" style="width:100%">Criar administrador</button></form>');
  document.getElementById('setup-form').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const password = form.elements.password.value;
    if (password !== document.getElementById('setup-confirm').value) {
      document.getElementById('setup-error').textContent = 'As senhas não coincidem.';
      return;
    }
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    try {
      await api('/setup/admin', {method: 'POST', body: JSON.stringify({
        username: form.elements.username.value, name: form.elements.name.value, password,
        departments: document.getElementById('setup-departments').value.split(/\r?\n/).map(x => x.trim()).filter(Boolean),
      })});
      showLogin(false, 'Administrador criado. Entre com as credenciais escolhidas.');
    } catch (error) {
      document.getElementById('setup-error').textContent = error.message;
      button.disabled = false;
    }
  });
}

function showCloudBootstrap() {
  layout('Configurar administrador inicial', '<p>Crie a primeira conta no Supabase e associe-a ao SIGAM antes de entrar.</p><ol><li>Abra o painel do Supabase e vá a <b>Authentication → Users → Add user</b>. Crie o usuário com o e-mail e senha do administrador.</li><li>No <b>SQL Editor</b>, execute o arquivo <code>supabase/bootstrap_admin.sql</code>, substituindo o e-mail e o nome de exemplo.</li><li>Atualize esta página e entre com as credenciais definidas no Supabase.</li></ol><p><a class="button button-primary" href="https://supabase.com/dashboard" target="_blank" rel="noopener">Abrir Supabase</a></p>');
}

async function init() {
  try {
    try {
      await api('/me');
      window.location.replace('/produtividade.html');
      return;
    } catch {}
    try {
      const status = await api('/setup/status');
      if (status.needsAdmin) {
        if (status.remoteSetupAllowed) showSetup();
        else showCloudBootstrap();
      } else showLogin();
    } catch (error) {
      showLogin(error.message);
    }
  } catch (error) {
    showError(error.message);
  }
}

init();
