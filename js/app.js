// Shell da aplicação e navegação entre os módulos disponíveis.
const APP_ROUTES = {
  dashboard: { title: 'Painel administrativo', render: renderPainelInterno },
  documentos: { title: 'Documentos internos', render: renderDocumentos },
  tarefas: { title: 'Tarefas e prazos', render: renderTarefas },
  secretarias: { title: 'Secretarias', render: renderSecretarias }
};

let currentRoute = 'dashboard';
const routeHistory = [];

function navigate(route, { recordHistory = true } = {}) {
  const page = APP_ROUTES[route];
  if (!page) {
    showToast('Esta tela não está disponível nesta versão.', 'warning');
    return;
  }

  const nextRoute = route === 'ouvidoria' ? 'protocolos' : route;
  if (recordHistory && nextRoute !== currentRoute) routeHistory.push(currentRoute);
  currentRoute = nextRoute;
  document.getElementById('app-content').innerHTML = page.render();
  document.getElementById('current-page').textContent = page.title;
  document.querySelectorAll('.nav-item[data-route]').forEach(item => {
    const active = item.dataset.route === currentRoute;
    item.classList.toggle('active', active);
    if (active) item.setAttribute('aria-current', 'page');
    else item.removeAttribute('aria-current');
  });

  atualizarContagemNotificacoes();
  alternarNotificacoes(false);
  toggleSidebar(false);
  atualizarBotaoVoltar();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function voltarRota() {
  const previousRoute = routeHistory.pop();
  if (!previousRoute) {
    showToast('Você já está na primeira tela desta navegação.', 'info');
    atualizarBotaoVoltar();
    return;
  }
  navigate(previousRoute, { recordHistory: false });
}

function atualizarBotaoVoltar() {
  const button = document.getElementById('back-route');
  if (!button) return;
  const canGoBack = routeHistory.length > 0;
  button.disabled = !canGoBack;
  button.title = canGoBack ? 'Voltar à tela anterior' : 'Você está no início da navegação';
  button.setAttribute('aria-label', button.title);
}

function fecharModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('active');
}

function toggleSidebar(force) {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  const toggle = document.getElementById('sidebar-toggle');
  const app = document.getElementById('app');
  const isMobile = window.matchMedia ? window.matchMedia('(max-width: 768px)').matches : false;
  if (!isMobile) {
    if (typeof force === 'boolean') return;
    const collapsed = app.classList.toggle('sidebar-collapsed');
    try { localStorage.setItem('sigam.sidebar.collapsed', String(collapsed)); } catch { /* Preferência opcional. */ }
    if (toggle) {
      toggle.setAttribute('aria-expanded', String(!collapsed));
      toggle.setAttribute('aria-label', collapsed ? 'Expandir menu' : 'Recolher menu');
      toggle.title = collapsed ? 'Expandir menu' : 'Recolher menu';
    }
    return;
  }
  const open = typeof force === 'boolean' ? force : !sidebar.classList.contains('open');
  sidebar.classList.toggle('open', open);
  backdrop.classList.toggle('visible', open);
  if (toggle) toggle.setAttribute('aria-expanded', String(open));
}

function showToast(message, type = 'info') {
  const region = document.getElementById('toast-region');
  if (!region) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${['success', 'warning', 'error', 'info'].includes(type) ? type : 'info'}`;
  toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
  toast.textContent = message;
  region.appendChild(toast);
  window.setTimeout(() => toast.remove(), 4200);
}

function csvCell(value) {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[\s\u0000-\u001f]*[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCSV(filename, columns, rows) {
  const content = [columns, ...rows].map(row => row.map(csvCell).join(';')).join('\r\n');
  const blob = new Blob(['\ufeff', content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast('Arquivo CSV baixado.', 'success');
}

function renderSecretarias() {
  const rows = DB.secretarias.map(item => `
    <tr data-search="${escapeHTML([item.nome, item.secretario, item.email, item.telefone].join(' ').toLowerCase())}">
      <td>${escapeHTML(item.nome)}</td><td>${escapeHTML(item.secretario)}</td>
      <td>${Number(item.funcionarios).toLocaleString('pt-BR')}</td><td>${formatCurrency(item.orcamento)}</td>
      <td><a class="table-link" href="mailto:${escapeHTML(item.email)}">${escapeHTML(item.email)}</a></td>
    </tr>`).join('');
  return `
    <div class="page-header"><div class="page-header-info"><h2>Secretarias</h2><p>Lista de referência usada para organizar documentos e tarefas; os dados exibidos são exemplos.</p></div></div>
    <section class="card">
      <div class="card-header"><div><h3 class="card-title">Unidades administrativas</h3><p class="card-subtitle">Consulta de contatos e indicadores cadastrados.</p></div>
        <label class="table-search"><span class="sr-only">Pesquisar secretarias</span><input class="form-control" type="search" placeholder="Pesquisar secretaria ou responsável" oninput="filtrarTabela(this, 'secretarias-table')"></label>
      </div>
      <div class="table-wrapper"><table class="data-table" id="secretarias-table"><thead><tr><th>Secretaria</th><th>Responsável</th><th>Servidores</th><th>Orçamento</th><th>E-mail</th></tr></thead><tbody>${rows || emptyTableRow(5, 'Nenhuma secretaria cadastrada.')}</tbody></table></div>
      <p class="table-empty hidden" id="secretarias-empty">Nenhum resultado para a pesquisa.</p>
    </section>`;
}

function filtrarTabela(input, tableId) {
  const table = document.getElementById(tableId);
  if (!table) return;
  const query = input.value.trim().toLowerCase();
  let visible = 0;
  table.querySelectorAll('tbody tr[data-search]').forEach(row => {
    const matches = row.dataset.search.includes(query);
    row.hidden = !matches;
    if (matches) visible += 1;
  });
  const empty = document.getElementById(`${tableId.replace('-table', '')}-empty`);
  if (empty) empty.classList.toggle('hidden', visible > 0);
}

function emptyTableRow(columns, message) {
  return `<tr><td colspan="${columns}" class="empty-cell">${escapeHTML(message)}</td></tr>`;
}

document.addEventListener('DOMContentLoaded', () => {
  window.appReady = true;
  document.getElementById('today-date').textContent = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full' }).format(new Date());
  try {
    const collapsed = localStorage.getItem('sigam.sidebar.collapsed') === 'true';
    document.getElementById('app').classList.toggle('sidebar-collapsed', collapsed);
    const toggle = document.getElementById('sidebar-toggle');
    toggle.setAttribute('aria-expanded', String(!collapsed));
    toggle.setAttribute('aria-label', collapsed ? 'Expandir menu' : 'Recolher menu');
  } catch { /* Usa o menu expandido quando o armazenamento está indisponível. */ }
  document.querySelectorAll('.nav-item[data-route]').forEach(item => item.addEventListener('click', () => navigate(item.dataset.route)));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.active').forEach(modal => modal.classList.remove('active'));
      alternarNotificacoes(false);
      const searchResults = document.getElementById('global-search-results');
      if (searchResults) searchResults.hidden = true;
      toggleSidebar(false);
    }
  });
  document.addEventListener('click', event => {
    const wrap = document.querySelector('.header-menu-wrap');
    if (wrap && !wrap.contains(event.target)) alternarNotificacoes(false);
  });
  navigate('dashboard');
});
