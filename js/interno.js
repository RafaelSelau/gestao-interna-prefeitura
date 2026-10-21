// Fluxos internos do SIGAM: documentos com tramitação e tarefas com histórico.
const DOC_STATUS = [
  ['recebido', 'Recebido'], ['em_analise', 'Em análise'], ['encaminhado', 'Encaminhado'],
  ['aguardando_informacao', 'Aguardando informação'], ['concluido', 'Concluído'], ['arquivado', 'Arquivado']
];
const TASK_STATUS = [
  ['a_fazer', 'A fazer'], ['em_andamento', 'Em andamento'], ['aguardando_terceiros', 'Aguardando terceiros'],
  ['em_revisao', 'Em revisão'], ['concluida', 'Concluída'], ['cancelada', 'Cancelada']
];
const DEMO_ACTOR = 'Operador local (sem autenticação)';

function coletarNotificacoesPrazo() {
  const items = [];
  DB.tarefasInternas.filter(t => !['concluida', 'cancelada'].includes(t.status) && (dueIsOverdue(t.prazo, false) || dueIsSoon(t.prazo))).forEach(t => {
    items.push({ id: `tarefa:${t.id}:${t.prazo}`, route: 'tarefas', recordId: t.id, title: t.titulo, type: 'Tarefa', date: t.prazo, overdue: dueIsOverdue(t.prazo, false) });
  });
  DB.documentosInternos.filter(d => !['concluido', 'arquivado'].includes(d.status) && (dueIsOverdue(d.prazo, false) || dueIsSoon(d.prazo))).forEach(d => {
    items.push({ id: `documento:${d.id}:${d.prazo}`, route: 'documentos', recordId: d.id, title: d.titulo, type: 'Documento', date: d.prazo, overdue: dueIsOverdue(d.prazo, false) });
  });
  return items.sort((a, b) => Number(b.overdue) - Number(a.overdue) || a.date.localeCompare(b.date));
}

function getNotificacoesLidas() {
  try { return new Set(JSON.parse(localStorage.getItem('sigam.notifications.read') || '[]')); }
  catch { return new Set(); }
}

function salvarNotificacoesLidas(read) {
  try { localStorage.setItem('sigam.notifications.read', JSON.stringify([...read])); }
  catch { showToast('Não foi possível guardar a leitura dos alertas neste navegador.', 'warning'); }
}

function atualizarContagemNotificacoes() {
  const badge = document.getElementById('notification-count');
  if (!badge) return;
  const items = coletarNotificacoesPrazo();
  const read = getNotificacoesLidas();
  const unread = items.filter(item => !read.has(item.id)).length;
  badge.textContent = unread > 9 ? '9+' : String(unread);
  badge.hidden = unread === 0;
  const button = document.getElementById('notifications-toggle');
  if (button) button.setAttribute('aria-label', unread ? `Notificações, ${unread} não lidas` : 'Notificações');
}

function renderPainelNotificacoes() {
  const container = document.getElementById('notification-panel-content');
  if (!container) return;
  const items = coletarNotificacoesPrazo();
  const read = getNotificacoesLidas();
  const unread = items.filter(item => !read.has(item.id)).length;
  container.innerHTML = `<div class="notification-panel-header"><div><strong>Prazos e alertas</strong><small>${unread ? `${unread} não lido(s)` : 'Atualizado com os registros locais'}</small></div><button type="button" class="notification-mark-read" onclick="marcarNotificacoesComoLidas()" ${unread ? '' : 'disabled'}>Marcar como lidos</button></div>${items.length ? `<div class="notification-list">${items.map(item => `<button type="button" class="notification-item ${item.overdue ? 'is-overdue' : ''} ${read.has(item.id) ? 'is-read' : ''}" onclick="abrirNotificacao('${item.route}','${item.recordId}','${item.id}')"><span class="notification-dot" aria-hidden="true"></span><span><strong>${escapeHTML(item.title)}</strong><small>${escapeHTML(item.type)} · ${item.overdue ? 'Prazo vencido' : 'Prazo próximo'} · ${formatDate(item.date)}</small></span></button>`).join('')}</div>` : '<p class="notification-empty">Nenhum prazo vencido ou previsto para os próximos sete dias.</p>'}<p class="notification-footnote">Alertas calculados localmente. Este protótipo não envia notificações.</p>`;
}

function alternarNotificacoes(force) {
  const panel = document.getElementById('notification-panel');
  const button = document.getElementById('notifications-toggle');
  if (!panel || !button) return;
  const open = typeof force === 'boolean' ? force : panel.hidden;
  panel.hidden = !open;
  button.setAttribute('aria-expanded', String(open));
  if (open) renderPainelNotificacoes();
}

function marcarNotificacoesComoLidas() {
  salvarNotificacoesLidas(new Set(coletarNotificacoesPrazo().map(item => item.id)));
  atualizarContagemNotificacoes();
  renderPainelNotificacoes();
}

function abrirNotificacao(route, recordId, notificationId) {
  const read = getNotificacoesLidas();
  read.add(notificationId);
  salvarNotificacoesLidas(read);
  atualizarContagemNotificacoes();
  alternarNotificacoes(false);
  navigate(route);
  window.setTimeout(() => route === 'documentos' ? verDocumento(recordId) : verTarefa(recordId), 0);
}

function abrirInfoSessao() {
  document.getElementById('modal-sessao')?.classList.add('active');
}

function selecionarPrimeiroResultadoGlobal() {
  document.querySelector('#global-search-results .global-search-result')?.click();
}

function aplicarFiltroDashboard(route, filter) {
  if (route === 'tarefas') window.taskDashboardFilter = filter;
  if (route === 'documentos') window.docDashboardFilter = filter;
  navigate(route);
  if (route === 'tarefas') filtrarTarefas();
  if (route === 'documentos') filtrarDocumentos();
}

function renderPainelInterno() {
  const activeTasks = DB.tarefasInternas.filter(t => !['concluida', 'cancelada'].includes(t.status));
  const overdueTasks = activeTasks.filter(t => dueIsOverdue(t.prazo, false));
  const doneSince = Date.now() - 7 * 86400000;
  const completedWeek = DB.tarefasInternas.filter(t => t.status === 'concluida' && t.concluidaEm && new Date(t.concluidaEm).getTime() >= doneSince).length;
  const pendingDocs = DB.documentosInternos.filter(d => ['recebido', 'em_analise', 'encaminhado', 'aguardando_informacao'].includes(d.status));
  const soonDocs = pendingDocs.filter(d => dueIsSoon(d.prazo));
  const priorityRank = { alta: 0, media: 1, baixa: 2 };
  const priorityTasks = activeTasks.slice().sort((a,b) => (priorityRank[a.prioridade] ?? 1) - (priorityRank[b.prioridade] ?? 1) || (a.prazo || '9999').localeCompare(b.prazo || '9999')).slice(0,5);
  const departments = DB.secretarias.map(s => ({ name: s.nome, tasks: activeTasks.filter(t => t.secretaria === s.nome).length, docs: pendingDocs.filter(d => d.secretariaAtual === s.nome).length })).filter(s => s.tasks + s.docs > 0).sort((a,b) => b.tasks + b.docs - a.tasks - a.docs);
  const recent = [...DB.documentosInternos.flatMap(d => (d.historico || []).map(h=>({ ...h, registro:d.titulo, tipo:'Documento' }))), ...DB.tarefasInternas.flatMap(t => (t.historico || []).map(h=>({ ...h, registro:t.titulo, tipo:'Tarefa' })))].sort((a,b)=>new Date(b.em)-new Date(a.em)).slice(0,6);
  return `<div class="page-header"><div class="page-header-info"><h2>Organização interna</h2><p>Acompanhe documentos, tarefas e prazos das secretarias.</p></div><div class="page-header-actions"><button class="btn btn-secondary" onclick="navigate('documentos')">Abrir documentos</button><button class="btn btn-primary" onclick="abrirTarefaNova()">Nova tarefa</button></div></div>
    <div class="grid-4 compact-stats">${[['Tarefas em aberto',activeTasks.length,'tarefas','abertas'],['Tarefas atrasadas',overdueTasks.length,'tarefas','atrasadas'],['Concluídas na semana',completedWeek,'tarefas','concluidas'],['Documentos aguardando análise',pendingDocs.length,'documentos','em_fluxo'],['Documentos com prazo em 7 dias',soonDocs.length,'documentos','prazo']].map(([label,value,route,filter])=>`<button type="button" class="stat-card stat-card-button" onclick="aplicarFiltroDashboard('${route}','${filter}')" aria-label="${label}: ${value}. Abrir registros"><span class="stat-value">${value}</span><span class="stat-label">${label}</span></button>`).join('')}</div>
    <div class="grid-2 admin-dashboard-grid"><section class="card"><div class="card-header"><div><h3 class="card-title">Tarefas prioritárias</h3><p class="card-subtitle">Ordenadas por prioridade e prazo.</p></div><button class="btn btn-secondary btn-sm" onclick="navigate('tarefas')">Ver tarefas</button></div>${priorityTasks.length ? `<div class="priority-list">${priorityTasks.map(t=>`<button type="button" class="priority-row" onclick="navigate('tarefas');setTimeout(()=>verTarefa('${t.id}'),0)"><span class="priority-${escapeHTML(t.prioridade)}">${escapeHTML(({alta:'Alta',media:'Média',baixa:'Baixa'})[t.prioridade] || 'Média')}</span><strong>${escapeHTML(t.titulo)}</strong><small>${escapeHTML(t.secretaria)} · ${t.prazo ? `Prazo ${formatDate(t.prazo)}` : 'Sem prazo'}</small></button>`).join('')}</div>` : '<div class="empty-state">Ainda não há tarefas. Crie uma para acompanhar o responsável e o prazo.</div>'}</section>
    <section class="card"><div class="card-header"><div><h3 class="card-title">Documentos com prazo próximo</h3></div><button class="btn btn-secondary btn-sm" onclick="navigate('documentos')">Ver documentos</button></div>${soonDocs.length ? `<div class="priority-list">${soonDocs.slice(0,4).map(d=>`<button type="button" class="priority-row" onclick="navigate('documentos');setTimeout(()=>verDocumento('${d.id}'),0)"><strong>${escapeHTML(d.titulo)}</strong><small>${escapeHTML(d.secretariaAtual)} · Prazo ${formatDate(d.prazo)}</small></button>`).join('')}</div>` : '<p class="form-hint">Nenhum documento vence nos próximos sete dias.</p>'}</section>
    <section class="card"><div class="card-header"><div><h3 class="card-title">Pendências por secretaria</h3><p class="card-subtitle">Tarefas abertas e documentos em tramitação</p></div></div>${departments.length ? `<div class="table-wrapper"><table class="data-table"><thead><tr><th>Secretaria</th><th>Tarefas</th><th>Documentos</th></tr></thead><tbody>${departments.map(s=>`<tr><td>${escapeHTML(s.name)}</td><td>${s.tasks}</td><td>${s.docs}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty-state">As pendências por secretaria aparecerão quando houver registros.</div>'}</section>
    <section class="card"><div class="card-header"><div><h3 class="card-title">Atividades recentes</h3><p class="card-subtitle">Registro cronológico das ações locais</p></div></div>${recent.length ? `<ol class="recent-activity">${recent.map(h=>`<li><strong>${escapeHTML(h.acao)}</strong><span>${escapeHTML(h.tipo)} · ${escapeHTML(h.registro)}</span><small>${formatTimestamp(h.em)} · ${escapeHTML(h.usuario)}</small></li>`).join('')}</ol>` : '<div class="empty-state">O histórico aparecerá após criar ou movimentar documentos e tarefas.</div>'}</section></div>
    <p class="prototype-notice">Os documentos e as tarefas ficam salvos somente neste navegador. Este sistema não tem login nem compartilhamento entre usuários; não armazene informações sigilosas.</p>`;
}

function optionList(items, selected = '') {
  return items.map(([value, label]) => `<option value="${value}" ${value === selected ? 'selected' : ''}>${escapeHTML(label)}</option>`).join('');
}

function secretaryOptions(selected = '') {
  return DB.secretarias.map(s => `<option value="${escapeHTML(s.nome)}" ${s.nome === selected ? 'selected' : ''}>${escapeHTML(s.nome)}</option>`).join('');
}

function statusLabel(options, status) {
  return options.find(([value]) => value === status)?.[1] || 'Sem status';
}

function statusTag(options, status) {
  const variant = status === 'concluido' || status === 'concluida' ? 'success'
    : status === 'arquivado' || status === 'cancelada' ? 'default'
      : status === 'aguardando_informacao' || status === 'aguardando_terceiros' ? 'warning'
        : status === 'em_analise' || status === 'em_revisao' ? 'info' : 'primary';
  return `<span class="badge badge-${variant}">${escapeHTML(statusLabel(options, status))}</span>`;
}

function localToday() {
  const date = new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function dueIsOverdue(date, closed) {
  return Boolean(date && date < localToday() && !closed);
}

function dueIsSoon(date) {
  if (!date) return false;
  const today = new Date(`${localToday()}T00:00:00`);
  const due = new Date(`${date}T00:00:00`);
  const days = (due - today) / 86400000;
  return days >= 0 && days <= 7;
}

function formatTimestamp(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

function salvarBancoInterno(update) {
  const docsAntes = JSON.stringify(DB.documentosInternos);
  const tarefasAntes = JSON.stringify(DB.tarefasInternas);
  update();
  if (saveToStorage()) return true;
  DB.documentosInternos = JSON.parse(docsAntes);
  DB.tarefasInternas = JSON.parse(tarefasAntes);
  showToast('Não foi possível guardar a alteração no armazenamento local.', 'error');
  return false;
}

function registrarHistorico(registro, acao, detalhes = '') {
  if (!Array.isArray(registro.historico)) registro.historico = [];
  registro.historico.unshift({ em: new Date().toISOString(), usuario: DEMO_ACTOR, acao, detalhes });
}

function proximoCodigoDocumento() {
  let sequence = DB.documentosInternos.length + 1;
  let code;
  do {
    code = `SIGAM-${new Date().getFullYear()}-${String(sequence++).padStart(4, '0')}`;
  } while (DB.documentosInternos.some(d => d.codigo === code));
  return code;
}

function renderDocumentos() {
  const emAnalise = DB.documentosInternos.filter(d => ['recebido', 'em_analise', 'encaminhado', 'aguardando_informacao'].includes(d.status)).length;
  const atrasados = DB.documentosInternos.filter(d => dueIsOverdue(d.prazo, ['concluido', 'arquivado'].includes(d.status))).length;
  const proximos = DB.documentosInternos.filter(d => dueIsSoon(d.prazo) && !['concluido', 'arquivado'].includes(d.status)).length;
  const concluidos = DB.documentosInternos.filter(d => d.status === 'concluido').length;
  const rows = DB.documentosInternos.map(d => `
    <tr>
      <td><span class="table-id">${escapeHTML(d.codigo)}</span></td>
      <td><strong>${escapeHTML(d.titulo)}</strong><small class="table-secondary">${escapeHTML(d.tipo)}${d.anexo?.nome ? ` · ${escapeHTML(d.anexo.nome)}` : ''}</small></td>
      <td>${escapeHTML(d.secretariaAtual || '—')}</td>
      <td>${escapeHTML(d.responsavel || '—')}</td>
      <td>${d.prazo ? `<span class="${dueIsOverdue(d.prazo, ['concluido', 'arquivado'].includes(d.status)) ? 'text-danger' : dueIsSoon(d.prazo) ? 'text-warning' : ''}">${formatDate(d.prazo)}</span>` : '—'}</td>
      <td>${statusTag(DOC_STATUS, d.status)}</td>
      <td><div class="table-actions"><button class="btn btn-secondary btn-sm" type="button" onclick="verDocumento('${d.id}')">Abrir</button><button class="btn btn-secondary btn-sm" type="button" onclick="editarDocumento('${d.id}')">Editar</button></div></td>
    </tr>`).join('');
  return `
    <div class="page-header"><div class="page-header-info"><h2>Documentos internos</h2><p>Cadastro e tramitação entre secretarias. Protótipo local sem controle de acesso.</p></div>
      <div class="page-header-actions"><button class="btn btn-secondary" type="button" onclick="exportarDocumentosInternos()">Exportar CSV</button><button class="btn btn-primary" type="button" onclick="abrirDocumentoNovo()">Novo documento</button></div>
    </div>
    <div class="grid-4 compact-stats">
      ${[['Em fluxo', emAnalise], ['Prazo vencido', atrasados], ['Vencem em 7 dias', proximos], ['Concluídos', concluidos]].map(([label, value]) => `<div class="stat-card"><div class="stat-value">${value}</div><div class="stat-label">${label}</div></div>`).join('')}
    </div>
    <section class="card">
      <div class="toolbar-filters">
        <input class="form-control" id="docs-search" type="search" placeholder="Buscar título, código, tipo ou responsável" oninput="filtrarDocumentos(true)">
        <select class="form-control" id="docs-secretaria" onchange="filtrarDocumentos(true)"><option value="">Todas as secretarias</option>${secretaryOptions()}</select>
        <select class="form-control" id="docs-status" onchange="filtrarDocumentos(true)"><option value="">Todos os status</option>${optionList(DOC_STATUS)}</select>
        <button class="btn btn-secondary" type="button" onclick="limparFiltrosInternos('documentos')">Limpar filtros</button>
        <span id="docs-count" class="count-label">${DB.documentosInternos.length} registros</span>
      </div>
      <p id="docs-dashboard-filter" class="dashboard-filter-hint" hidden></p>
      <div class="table-wrapper"><table class="data-table"><thead><tr><th>Código</th><th>Documento</th><th>Secretaria atual</th><th>Responsável</th><th>Prazo</th><th>Situação</th><th>Ações</th></tr></thead><tbody id="docs-tbody">${rows || emptyTableRow(7, 'Nenhum documento cadastrado. Use “Novo documento” para iniciar.')}</tbody></table></div>
    </section>
    <div class="modal-overlay" id="modal-documento"><div class="modal modal-wide">
      <div class="modal-header"><h3 class="modal-title" id="documento-form-title">Novo documento</h3><button class="modal-close" type="button" aria-label="Fechar" onclick="fecharModal('modal-documento')">×</button></div>
      <form id="form-documento" onsubmit="salvarDocumento(event)">
        <div class="form-row"><div class="form-group"><label class="form-label" for="doc-titulo">Título *</label><input class="form-control" id="doc-titulo" maxlength="140" required></div><div class="form-group"><label class="form-label" for="doc-codigo">Número/código</label><input class="form-control" id="doc-codigo" maxlength="60" placeholder="Gerado automaticamente se vazio"></div></div>
        <div class="form-row"><div class="form-group"><label class="form-label" for="doc-tipo">Tipo *</label><select class="form-control" id="doc-tipo" required><option value="">Selecione</option>${['Ofício','Memorando','Portaria','Decreto','Relatório','Ata de reunião','Requerimento','Contrato','Processo administrativo','Comunicado interno','Outro'].map(t => `<option>${t}</option>`).join('')}</select></div><div class="form-group"><label class="form-label" for="doc-responsavel">Responsável</label><input class="form-control" id="doc-responsavel" maxlength="100"></div></div>
        <div class="form-row"><div class="form-group"><label class="form-label" for="doc-origem">Secretaria de origem *</label><select class="form-control" id="doc-origem" required><option value="">Selecione</option>${secretaryOptions()}</select></div><div class="form-group"><label class="form-label" for="doc-destino">Secretaria responsável *</label><select class="form-control" id="doc-destino" required><option value="">Selecione</option>${secretaryOptions()}</select></div></div>
        <div class="form-row"><div class="form-group"><label class="form-label" for="doc-emissao">Data de emissão</label><input type="date" class="form-control" id="doc-emissao"></div><div class="form-group"><label class="form-label" for="doc-recebimento">Data de recebimento</label><input type="date" class="form-control" id="doc-recebimento"></div><div class="form-group"><label class="form-label" for="doc-prazo">Prazo de resposta</label><input type="date" class="form-control" id="doc-prazo"></div></div>
        <div class="form-group"><label class="form-label" for="doc-descricao">Descrição</label><textarea class="form-control" id="doc-descricao" rows="3" maxlength="2000"></textarea></div>
        <div class="form-row"><div class="form-group"><label class="form-label" for="doc-palavras">Palavras-chave</label><input class="form-control" id="doc-palavras" maxlength="200"></div><div class="form-group"><label class="form-label" for="doc-acesso">Nível de acesso (informativo)</label><select class="form-control" id="doc-acesso"><option value="interno">Interno</option><option value="restrito">Restrito (sem proteção real neste protótipo)</option></select></div></div>
        <div class="form-group"><label class="form-label" for="doc-anexo">Arquivo anexo (máx. 1 MB; fica apenas neste navegador)</label><input class="form-control" id="doc-anexo" type="file" accept=".pdf,.doc,.docx,.odt,.txt,.png,.jpg,.jpeg"><small class="form-hint">Este armazenamento local não é seguro nem compartilhado. Não anexe documentos sigilosos ou dados reais.</small><div id="doc-anexo-atual" class="form-hint"></div></div>
        <div class="form-group"><label class="form-label" for="doc-observacoes">Observações</label><textarea class="form-control" id="doc-observacoes" rows="2" maxlength="1000"></textarea></div>
        <input id="doc-id" type="hidden"><div class="modal-actions"><button class="btn btn-secondary" type="button" onclick="fecharModal('modal-documento')">Cancelar</button><button class="btn btn-primary" type="submit">Salvar documento</button></div>
      </form>
    </div></div>
    <div class="modal-overlay" id="modal-detalhe-documento"><div class="modal modal-wide" id="documento-detalhe-content"></div></div>`;
}

function atualizarTabelaDocumentos(lista) {
  const tbody = document.getElementById('docs-tbody');
  if (!tbody) return;
  const rows = lista.map(d => `<tr><td><span class="table-id">${escapeHTML(d.codigo)}</span></td><td><strong>${escapeHTML(d.titulo)}</strong><small class="table-secondary">${escapeHTML(d.tipo)}${d.anexo?.nome ? ` · ${escapeHTML(d.anexo.nome)}` : ''}</small></td><td>${escapeHTML(d.secretariaAtual || '—')}</td><td>${escapeHTML(d.responsavel || '—')}</td><td>${d.prazo ? `<span class="${dueIsOverdue(d.prazo, ['concluido', 'arquivado'].includes(d.status)) ? 'text-danger' : dueIsSoon(d.prazo) ? 'text-warning' : ''}">${formatDate(d.prazo)}</span>` : '—'}</td><td>${statusTag(DOC_STATUS, d.status)}</td><td><div class="table-actions"><button class="btn btn-secondary btn-sm" type="button" onclick="verDocumento('${d.id}')">Abrir</button><button class="btn btn-secondary btn-sm" type="button" onclick="editarDocumento('${d.id}')">Editar</button></div></td></tr>`).join('');
  tbody.innerHTML = rows || emptyTableRow(7, 'Nenhum documento corresponde aos filtros.');
  document.getElementById('docs-count').textContent = `${lista.length} de ${DB.documentosInternos.length} registros`;
}

function filtrarDocumentos(clearDashboard = false) {
  const q = (document.getElementById('docs-search')?.value || '').trim().toLocaleLowerCase('pt-BR');
  const sec = document.getElementById('docs-secretaria')?.value || '';
  const status = document.getElementById('docs-status')?.value || '';
  if (clearDashboard) window.docDashboardFilter = '';
  const dashboardFilter = window.docDashboardFilter || '';
  const filterHint = document.getElementById('docs-dashboard-filter');
  if (filterHint) {
    filterHint.hidden = !dashboardFilter;
    filterHint.textContent = dashboardFilter === 'prazo' ? 'Filtro do painel: documentos com prazo nos próximos sete dias.' : dashboardFilter ? 'Filtro do painel: documentos em tramitação.' : '';
  }
  const filtered = DB.documentosInternos.filter(d => (!q || [d.codigo,d.titulo,d.tipo,d.responsavel,d.palavrasChave].join(' ').toLocaleLowerCase('pt-BR').includes(q)) && (!sec || d.secretariaAtual === sec) && (!status || d.status === status) && (!dashboardFilter || (dashboardFilter === 'prazo' ? dueIsSoon(d.prazo) && !['concluido','arquivado'].includes(d.status) : ['recebido','em_analise','encaminhado','aguardando_informacao'].includes(d.status))));
  atualizarTabelaDocumentos(filtered);
}

function abrirDocumentoNovo() {
  document.getElementById('form-documento').reset();
  document.getElementById('doc-id').value = '';
  document.getElementById('doc-codigo').value = '';
  document.getElementById('documento-form-title').textContent = 'Novo documento';
  document.getElementById('doc-recebimento').value = localToday();
  document.getElementById('doc-anexo-atual').textContent = '';
  document.getElementById('modal-documento').classList.add('active');
}

function editarDocumento(id) {
  const d = DB.documentosInternos.find(item => item.id === id);
  if (!d) return;
  fecharModal('modal-detalhe-documento');
  abrirDocumentoNovo();
  document.getElementById('doc-id').value = d.id;
  document.getElementById('documento-form-title').textContent = 'Editar documento';
  document.getElementById('doc-titulo').value = d.titulo || '';
  document.getElementById('doc-codigo').value = d.codigo || '';
  document.getElementById('doc-tipo').value = d.tipo || '';
  document.getElementById('doc-responsavel').value = d.responsavel || '';
  document.getElementById('doc-origem').value = d.secretariaOrigem || '';
  document.getElementById('doc-destino').value = d.secretariaAtual || '';
  document.getElementById('doc-emissao').value = d.emissao || '';
  document.getElementById('doc-recebimento').value = d.recebimento || '';
  document.getElementById('doc-prazo').value = d.prazo || '';
  document.getElementById('doc-descricao').value = d.descricao || '';
  document.getElementById('doc-palavras').value = d.palavrasChave || '';
  document.getElementById('doc-acesso').value = d.acesso || 'interno';
  document.getElementById('doc-observacoes').value = d.observacoes || '';
  document.getElementById('doc-anexo-atual').textContent = d.anexo?.nome ? `Anexo atual: ${d.anexo.nome} (selecione outro para substituir).` : '';
}

function lerArquivo(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ nome: file.name, tipo: file.type || 'application/octet-stream', conteudo: reader.result });
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo selecionado.'));
    reader.readAsDataURL(file);
  });
}

async function salvarDocumento(event) {
  event.preventDefault();
  const id = document.getElementById('doc-id').value;
  const file = document.getElementById('doc-anexo').files[0];
  if (file && file.size > 1024 * 1024) return showToast('O anexo deve ter no máximo 1 MB.', 'warning');
  if (file && !/\.(pdf|doc|docx|odt|txt|png|jpe?g)$/i.test(file.name)) return showToast('Tipo de arquivo não permitido. Use PDF, Word, ODT, TXT, PNG ou JPG.', 'warning');
  let anexo;
  try { if (file) anexo = await lerArquivo(file); } catch { return showToast('Não foi possível ler o anexo.', 'error'); }
  const prior = DB.documentosInternos.find(d => d.id === id);
  const origem = document.getElementById('doc-origem').value;
  const destino = document.getElementById('doc-destino').value;
  const codigo = document.getElementById('doc-codigo').value.trim() || proximoCodigoDocumento();
  if (DB.documentosInternos.some(d => d.id !== id && d.codigo?.toLocaleLowerCase('pt-BR') === codigo.toLocaleLowerCase('pt-BR'))) {
    return showToast('Já existe um documento com esse código. Informe outro número.', 'warning');
  }
  const documento = {
    ...(prior || {}), id: id || generateId('DOC', DB.documentosInternos),
    codigo,
    titulo: document.getElementById('doc-titulo').value.trim(), tipo: document.getElementById('doc-tipo').value,
    secretariaOrigem: origem, secretariaAtual: destino, responsavel: document.getElementById('doc-responsavel').value.trim(),
    emissao: document.getElementById('doc-emissao').value, recebimento: document.getElementById('doc-recebimento').value,
    prazo: document.getElementById('doc-prazo').value, descricao: document.getElementById('doc-descricao').value.trim(),
    palavrasChave: document.getElementById('doc-palavras').value.trim(), acesso: document.getElementById('doc-acesso').value,
    observacoes: document.getElementById('doc-observacoes').value.trim(), status: prior?.status || 'recebido',
    anexo: anexo || prior?.anexo || null, atualizadoEm: new Date().toISOString()
  };
  const saved = salvarBancoInterno(() => {
    if (prior) {
      const index = DB.documentosInternos.findIndex(d => d.id === id);
      DB.documentosInternos[index] = documento;
      const fields = ['codigo','titulo','tipo','secretariaOrigem','secretariaAtual','responsavel','emissao','recebimento','prazo','descricao','palavrasChave','acesso','observacoes'];
      const changes = fields.filter(key => (prior[key] || '') !== (documento[key] || '')).map(key => key === 'secretariaAtual' ? 'secretaria responsável' : key);
      registrarHistorico(documento, 'Dados do documento atualizados', changes.length ? `Campos alterados: ${changes.join(', ')}.` : 'Nenhuma alteração nos metadados.');
    } else {
      documento.criadoEm = new Date().toISOString();
      documento.historico = [];
      registrarHistorico(documento, 'Documento registrado', `Origem: ${origem}; destino inicial: ${destino}.`);
      DB.documentosInternos.unshift(documento);
    }
  });
  if (!saved) return;
  fecharModal('modal-documento');
  showToast(prior ? 'Documento atualizado.' : 'Documento registrado e encaminhado à secretaria responsável.', 'success');
  navigate('documentos');
}

function verDocumento(id) {
  const d = DB.documentosInternos.find(item => item.id === id);
  if (!d) return;
  const history = (d.historico || []).map(h => `<li><strong>${escapeHTML(h.acao)}</strong><span>${formatTimestamp(h.em)} · ${escapeHTML(h.usuario)}</span>${h.detalhes ? `<p>${escapeHTML(h.detalhes)}</p>` : ''}</li>`).join('') || '<li>Sem movimentações registradas.</li>';
  const area = document.getElementById('documento-detalhe-content');
  area.innerHTML = `<div class="modal-header"><div><h3 class="modal-title">${escapeHTML(d.titulo)}</h3><p class="card-subtitle">${escapeHTML(d.codigo)} · ${escapeHTML(d.tipo)}</p></div><button class="modal-close" aria-label="Fechar" onclick="fecharModal('modal-detalhe-documento')">×</button></div>
    <div class="detail-grid"><div><small>Origem</small><strong>${escapeHTML(d.secretariaOrigem)}</strong></div><div><small>Secretaria atual</small><strong>${escapeHTML(d.secretariaAtual)}</strong></div><div><small>Responsável</small><strong>${escapeHTML(d.responsavel || '—')}</strong></div><div><small>Prazo</small><strong>${d.prazo ? formatDate(d.prazo) : '—'}</strong></div><div><small>Situação</small><strong>${statusTag(DOC_STATUS, d.status)}</strong></div><div><small>Acesso informativo</small><strong>${d.acesso === 'restrito' ? 'Restrito (sem proteção real)' : 'Interno'}</strong></div></div>
    <p class="detail-description">${escapeHTML(d.descricao || 'Sem descrição.')}</p>${d.observacoes ? `<p class="form-hint">Observações: ${escapeHTML(d.observacoes)}</p>` : ''}${d.anexo?.conteudo ? `<p class="attachment-link">Anexo: <a download="${escapeHTML(d.anexo.nome)}" href="${d.anexo.conteudo}">${escapeHTML(d.anexo.nome)}</a></p>` : ''}
    <div class="movement-panel"><h4>Atualizar situação ou encaminhar</h4><div class="form-row"><label class="form-group"><span class="form-label">Nova secretaria responsável</span><select class="form-control" id="doc-move-destination"><option value="">Manter atual (${escapeHTML(d.secretariaAtual)})</option>${secretaryOptions()}</select></label><label class="form-group"><span class="form-label">Situação</span><select class="form-control" id="doc-move-status">${optionList(DOC_STATUS, d.status)}</select></label></div><label class="form-group"><span class="form-label">Despacho / observação da movimentação</span><textarea class="form-control" id="doc-move-note" rows="2" maxlength="1000"></textarea></label><div class="modal-actions"><button class="btn btn-secondary" onclick="editarDocumento('${d.id}')">Editar dados</button><button class="btn btn-primary" onclick="salvarMovimentacaoDocumento('${d.id}')">Registrar movimentação</button></div></div>
    <div class="history-panel"><h4>Histórico de movimentações</h4><ol>${history}</ol></div>`;
  document.getElementById('modal-detalhe-documento').classList.add('active');
}

function salvarMovimentacaoDocumento(id) {
  const d = DB.documentosInternos.find(item => item.id === id);
  if (!d) return;
  const destination = document.getElementById('doc-move-destination').value;
  const nextStatus = document.getElementById('doc-move-status').value;
  const note = document.getElementById('doc-move-note').value.trim();
  const previous = d.secretariaAtual;
  const previousStatus = d.status;
  const saved = salvarBancoInterno(() => {
    if (destination && destination !== d.secretariaAtual) d.secretariaAtual = destination;
    d.status = nextStatus;
    d.atualizadoEm = new Date().toISOString();
    const details = [destination && destination !== previous ? `Encaminhado de ${previous} para ${destination}.` : '', nextStatus !== previousStatus ? `Situação: ${statusLabel(DOC_STATUS, nextStatus)}.` : '', note].filter(Boolean).join(' ');
    registrarHistorico(d, destination && destination !== previous ? 'Documento encaminhado' : `Situação alterada para ${statusLabel(DOC_STATUS, nextStatus)}`, details);
  });
  if (!saved) return;
  fecharModal('modal-detalhe-documento');
  navigate('documentos');
  verDocumento(id);
  showToast('Movimentação registrada no histórico local.', 'success');
}

function exportarDocumentosInternos() {
  downloadCSV('sigam_documentos.csv', ['Código','Título','Tipo','Origem','Secretaria atual','Responsável','Prazo','Situação','Acesso informativo','Palavras-chave'], DB.documentosInternos.map(d => [d.codigo,d.titulo,d.tipo,d.secretariaOrigem,d.secretariaAtual,d.responsavel,d.prazo,statusLabel(DOC_STATUS,d.status),d.acesso,d.palavrasChave]));
}

function renderTarefas() {
  window.taskView = 'lista';
  const active = DB.tarefasInternas.filter(t => !['concluida','cancelada'].includes(t.status));
  const overdue = active.filter(t => dueIsOverdue(t.prazo, false)).length;
  const dueSoon = active.filter(t => dueIsSoon(t.prazo)).length;
  const done = DB.tarefasInternas.filter(t => t.status === 'concluida').length;
  const initialFilter = window.taskDashboardFilter || '';
  const rows = renderTabelaTarefas(DB.tarefasInternas.filter(t => !initialFilter || (initialFilter === 'abertas' ? !['concluida','cancelada'].includes(t.status) : initialFilter === 'atrasadas' ? !['concluida','cancelada'].includes(t.status) && dueIsOverdue(t.prazo, false) : initialFilter === 'concluidas' ? t.status === 'concluida' && t.concluidaEm && new Date(t.concluidaEm).getTime() >= Date.now() - 7 * 86400000 : dueIsSoon(t.prazo) && !['concluida','cancelada'].includes(t.status))));
  return `<div class="page-header"><div class="page-header-info"><h2>Tarefas e prazos</h2><p>Responsáveis, prioridades e histórico de execução. Os dados ficam somente neste navegador.</p></div><div class="page-header-actions"><button class="btn btn-secondary" onclick="exportarTarefasInternas()">Exportar CSV</button><button class="btn btn-primary" onclick="abrirTarefaNova()">Nova tarefa</button></div></div>
    <div class="grid-4 compact-stats">${[['Em aberto',active.length],['Atrasadas',overdue],['Vencem em 7 dias',dueSoon],['Concluídas',done]].map(([label,value])=>`<div class="stat-card"><div class="stat-value">${value}</div><div class="stat-label">${label}</div></div>`).join('')}</div>
    <section class="card"><div class="toolbar-filters"><input class="form-control" id="tasks-search" type="search" placeholder="Buscar tarefa, responsável ou setor" oninput="filtrarTarefas(true)"><select class="form-control" id="tasks-secretaria" onchange="filtrarTarefas(true)"><option value="">Todas as secretarias</option>${secretaryOptions()}</select><select class="form-control" id="tasks-status" onchange="filtrarTarefas(true)"><option value="">Todos os status</option>${optionList(TASK_STATUS)}</select><button class="btn btn-secondary" onclick="limparFiltrosInternos('tarefas')">Limpar filtros</button><span class="view-switch"><button id="tasks-view-list" class="btn btn-primary btn-sm" onclick="definirVisualizacaoTarefas('lista')">Lista</button><button id="tasks-view-board" class="btn btn-secondary btn-sm" onclick="definirVisualizacaoTarefas('quadro')">Quadro</button><button id="tasks-view-calendar" class="btn btn-secondary btn-sm" onclick="definirVisualizacaoTarefas('calendario')">Calendário</button></span></div><p id="tasks-dashboard-filter" class="dashboard-filter-hint" hidden></p><div id="tasks-results">${rows}</div></section>
    <div class="modal-overlay" id="modal-tarefa"><div class="modal modal-wide"><div class="modal-header"><h3 class="modal-title" id="tarefa-form-title">Nova tarefa</h3><button class="modal-close" aria-label="Fechar" onclick="fecharModal('modal-tarefa')">×</button></div><form id="form-tarefa" onsubmit="salvarTarefa(event)">
      <div class="form-group"><label class="form-label" for="task-title">Título *</label><input class="form-control" id="task-title" maxlength="140" required></div><div class="form-group"><label class="form-label" for="task-description">Descrição</label><textarea class="form-control" id="task-description" rows="3" maxlength="2000"></textarea></div>
      <div class="form-row"><div class="form-group"><label class="form-label" for="task-secretaria">Secretaria *</label><select class="form-control" id="task-secretaria" required><option value="">Selecione</option>${secretaryOptions()}</select></div><div class="form-group"><label class="form-label" for="task-sector">Setor</label><input class="form-control" id="task-sector" maxlength="100"></div></div>
      <div class="form-row"><div class="form-group"><label class="form-label" for="task-owner">Responsável</label><input class="form-control" id="task-owner" maxlength="100"></div><div class="form-group"><label class="form-label" for="task-due">Prazo final</label><input class="form-control" id="task-due" type="date"></div></div>
      <div class="form-row"><div class="form-group"><label class="form-label" for="task-priority">Prioridade</label><select class="form-control" id="task-priority"><option value="baixa">Baixa</option><option value="media" selected>Média</option><option value="alta">Alta</option></select></div><div class="form-group"><label class="form-label" for="task-status">Status</label><select class="form-control" id="task-status">${optionList(TASK_STATUS, 'a_fazer')}</select></div></div>
      <div class="form-group"><label class="form-label" for="task-document">Documento relacionado</label><select class="form-control" id="task-document"><option value="">Nenhum</option>${DB.documentosInternos.map(d=>`<option value="${escapeHTML(d.id)}">${escapeHTML(d.codigo)} — ${escapeHTML(d.titulo)}</option>`).join('')}</select></div><input type="hidden" id="task-id"><div class="modal-actions"><button type="button" class="btn btn-secondary" onclick="fecharModal('modal-tarefa')">Cancelar</button><button type="submit" class="btn btn-primary">Salvar tarefa</button></div>
    </form></div></div><div class="modal-overlay" id="modal-detalhe-tarefa"><div class="modal" id="tarefa-detalhe-content"></div></div>`;
}

function renderTabelaTarefas(lista) {
  if (!lista.length) return '<div class="empty-state">Nenhuma tarefa cadastrada. Crie uma tarefa para acompanhar responsáveis e prazos.</div>';
  const rows = lista.map(t => `<tr><td><strong>${escapeHTML(t.titulo)}</strong><small class="table-secondary">${escapeHTML(t.setor || 'Sem setor')}</small></td><td>${escapeHTML(t.secretaria)}</td><td>${escapeHTML(t.responsavel || '—')}</td><td><span class="priority-${escapeHTML(t.prioridade)}">${escapeHTML(({alta:'Alta',media:'Média',baixa:'Baixa'})[t.prioridade] || 'Média')}</span></td><td>${t.prazo ? `<span class="${dueIsOverdue(t.prazo, t.status === 'concluida') ? 'text-danger' : dueIsSoon(t.prazo) ? 'text-warning' : ''}">${formatDate(t.prazo)}</span>` : '—'}</td><td>${statusTag(TASK_STATUS,t.status)}</td><td><div class="table-actions"><button class="btn btn-secondary btn-sm" onclick="verTarefa('${t.id}')">Abrir</button><button class="btn btn-secondary btn-sm" onclick="editarTarefa('${t.id}')">Editar</button></div></td></tr>`).join('');
  return `<div class="table-wrapper"><table class="data-table"><thead><tr><th>Tarefa</th><th>Secretaria</th><th>Responsável</th><th>Prioridade</th><th>Prazo</th><th>Status</th><th>Ações</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function renderQuadroTarefas(lista) {
  return `<div class="kanban-board">${TASK_STATUS.map(([status,label])=>`<section class="kanban-column"><header><strong>${escapeHTML(label)}</strong><span>${lista.filter(t=>t.status===status).length}</span></header>${lista.filter(t=>t.status===status).map(t=>`<button class="kanban-card" type="button" onclick="verTarefa('${t.id}')"><strong>${escapeHTML(t.titulo)}</strong><span>${escapeHTML(t.secretaria)} · ${escapeHTML(t.responsavel || 'Sem responsável')}</span><span class="${dueIsOverdue(t.prazo,t.status==='concluida')?'text-danger':''}">${t.prazo ? `Prazo ${formatDate(t.prazo)}` : 'Sem prazo'}</span>${statusTag(TASK_STATUS,t.status)}</button>`).join('') || '<p class="form-hint">Sem tarefas</p>'}</section>`).join('')}</div>`;
}

function renderCalendarioTarefas(lista) {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay());
  const monthName = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(now);
  const days = Array.from({length:42}, (_,index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    const key = `${day.getFullYear()}-${String(day.getMonth()+1).padStart(2,'0')}-${String(day.getDate()).padStart(2,'0')}`;
    const tasks = lista.filter(t => t.prazo === key);
    return `<div class="calendar-day ${day.getMonth() === now.getMonth() ? '' : 'outside-month'}"><span class="calendar-date">${day.getDate()}</span>${tasks.map(t=>`<button class="calendar-task" type="button" onclick="verTarefa('${t.id}')">${escapeHTML(t.titulo)}</button>`).join('') || ''}</div>`;
  }).join('');
  return `<div class="calendar-heading"><strong>${escapeHTML(monthName)}</strong><span>Os cartões representam os prazos cadastrados</span></div><div class="calendar-grid">${['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(d=>`<div class="calendar-weekday">${d}</div>`).join('')}${days}</div><p class="form-hint">${lista.filter(t=>t.prazo).length} tarefa(s) com prazo no filtro atual. Tarefas sem prazo não aparecem no calendário.</p>`;
}

function filtrarTarefas(clearDashboard = false) {
  const q = (document.getElementById('tasks-search')?.value || '').trim().toLocaleLowerCase('pt-BR');
  const sec = document.getElementById('tasks-secretaria')?.value || '';
  const status = document.getElementById('tasks-status')?.value || '';
  if (clearDashboard) window.taskDashboardFilter = '';
  const dashboardFilter = window.taskDashboardFilter || '';
  const filterHint = document.getElementById('tasks-dashboard-filter');
  if (filterHint) {
    filterHint.hidden = !dashboardFilter;
    filterHint.textContent = ({ abertas: 'Filtro do painel: tarefas em aberto.', atrasadas: 'Filtro do painel: tarefas com prazo vencido.', concluidas: 'Filtro do painel: tarefas concluídas nos últimos sete dias.' })[dashboardFilter] || (dashboardFilter ? 'Filtro do painel: tarefas com prazo nos próximos sete dias.' : '');
  }
  const filtered = DB.tarefasInternas.filter(t => (!q || [t.titulo,t.descricao,t.responsavel,t.setor].join(' ').toLocaleLowerCase('pt-BR').includes(q)) && (!sec || t.secretaria === sec) && (!status || t.status === status) && (!dashboardFilter || (dashboardFilter === 'abertas' ? !['concluida','cancelada'].includes(t.status) : dashboardFilter === 'atrasadas' ? !['concluida','cancelada'].includes(t.status) && dueIsOverdue(t.prazo, false) : dashboardFilter === 'concluidas' ? t.status === 'concluida' && t.concluidaEm && new Date(t.concluidaEm).getTime() >= Date.now() - 7 * 86400000 : dueIsSoon(t.prazo) && !['concluida','cancelada'].includes(t.status))));
  document.getElementById('tasks-results').innerHTML = window.taskView === 'quadro' ? renderQuadroTarefas(filtered) : window.taskView === 'calendario' ? renderCalendarioTarefas(filtered) : renderTabelaTarefas(filtered);
}

function definirVisualizacaoTarefas(view) {
  window.taskView = view;
  document.getElementById('tasks-view-list').classList.toggle('btn-primary', view === 'lista');
  document.getElementById('tasks-view-board').classList.toggle('btn-primary', view === 'quadro');
  document.getElementById('tasks-view-calendar').classList.toggle('btn-primary', view === 'calendario');
  filtrarTarefas();
}

function abrirTarefaNova() {
  if (!document.getElementById('form-tarefa')) {
    window.taskDashboardFilter = '';
    navigate('tarefas');
    window.setTimeout(abrirTarefaNova, 0);
    return;
  }
  document.getElementById('form-tarefa').reset();
  document.getElementById('task-id').value = '';
  document.getElementById('task-status').value = 'a_fazer';
  document.getElementById('tarefa-form-title').textContent = 'Nova tarefa';
  document.getElementById('modal-tarefa').classList.add('active');
}

function editarTarefa(id) {
  const t = DB.tarefasInternas.find(item => item.id === id);
  if (!t) return;
  fecharModal('modal-detalhe-tarefa');
  abrirTarefaNova();
  document.getElementById('task-id').value = t.id;
  document.getElementById('tarefa-form-title').textContent = 'Editar tarefa';
  document.getElementById('task-title').value = t.titulo || '';
  document.getElementById('task-description').value = t.descricao || '';
  document.getElementById('task-secretaria').value = t.secretaria || '';
  document.getElementById('task-sector').value = t.setor || '';
  document.getElementById('task-owner').value = t.responsavel || '';
  document.getElementById('task-due').value = t.prazo || '';
  document.getElementById('task-priority').value = t.prioridade || 'media';
  document.getElementById('task-status').value = t.status || 'a_fazer';
  document.getElementById('task-document').value = t.documentoId || '';
}

function salvarTarefa(event) {
  event.preventDefault();
  const id = document.getElementById('task-id').value;
  const prior = DB.tarefasInternas.find(t => t.id === id);
  const nextStatus = document.getElementById('task-status').value;
  const tarefa = {
    ...(prior || {}), id: id || generateId('TAR', DB.tarefasInternas), titulo: document.getElementById('task-title').value.trim(),
    descricao: document.getElementById('task-description').value.trim(), secretaria: document.getElementById('task-secretaria').value,
    setor: document.getElementById('task-sector').value.trim(), responsavel: document.getElementById('task-owner').value.trim(),
    prazo: document.getElementById('task-due').value, prioridade: document.getElementById('task-priority').value,
    status: nextStatus, documentoId: document.getElementById('task-document').value || '', atualizadoEm: new Date().toISOString()
  };
  const saved = salvarBancoInterno(() => {
    if (prior) {
      const index = DB.tarefasInternas.findIndex(t => t.id === id);
      DB.tarefasInternas[index] = tarefa;
      if (prior.status !== nextStatus) registrarHistorico(tarefa, `Status alterado para ${statusLabel(TASK_STATUS,nextStatus)}`);
      else {
        const fields = ['titulo','descricao','secretaria','setor','responsavel','prazo','prioridade','documentoId'];
        const changes = fields.filter(key => (prior[key] || '') !== (tarefa[key] || ''));
        registrarHistorico(tarefa, 'Dados da tarefa atualizados', changes.length ? `Campos alterados: ${changes.join(', ')}.` : 'Nenhuma alteração nos campos.');
      }
      if (nextStatus === 'concluida' && prior.status !== 'concluida') tarefa.concluidaEm = new Date().toISOString();
      if (nextStatus !== 'concluida') tarefa.concluidaEm = '';
    } else {
      tarefa.criadaEm = new Date().toISOString();
      tarefa.historico = [];
      registrarHistorico(tarefa, 'Tarefa criada');
      if (nextStatus === 'concluida') tarefa.concluidaEm = new Date().toISOString();
      DB.tarefasInternas.unshift(tarefa);
    }
  });
  if (!saved) return;
  fecharModal('modal-tarefa');
  showToast(prior ? 'Tarefa atualizada.' : 'Tarefa criada.', 'success');
  navigate('tarefas');
}

function verTarefa(id) {
  const t = DB.tarefasInternas.find(item => item.id === id);
  if (!t) return;
  const history = (t.historico || []).map(h=>`<li><strong>${escapeHTML(h.acao)}</strong><span>${formatTimestamp(h.em)} · ${escapeHTML(h.usuario)}</span>${h.detalhes ? `<p>${escapeHTML(h.detalhes)}</p>` : ''}</li>`).join('') || '<li>Sem histórico.</li>';
  const linkedDoc = DB.documentosInternos.find(d=>d.id===t.documentoId);
  document.getElementById('tarefa-detalhe-content').innerHTML = `<div class="modal-header"><div><h3 class="modal-title">${escapeHTML(t.titulo)}</h3><p class="card-subtitle">${escapeHTML(t.secretaria)} · ${escapeHTML(t.setor || 'Sem setor')}</p></div><button class="modal-close" aria-label="Fechar" onclick="fecharModal('modal-detalhe-tarefa')">×</button></div><div class="detail-grid"><div><small>Responsável</small><strong>${escapeHTML(t.responsavel || '—')}</strong></div><div><small>Prioridade</small><strong>${escapeHTML(({alta:'Alta',media:'Média',baixa:'Baixa'})[t.prioridade] || 'Média')}</strong></div><div><small>Prazo</small><strong>${t.prazo ? formatDate(t.prazo) : '—'}</strong></div><div><small>Status</small><strong>${statusTag(TASK_STATUS,t.status)}</strong></div><div><small>Concluída em</small><strong>${formatTimestamp(t.concluidaEm)}</strong></div><div><small>Documento relacionado</small><strong>${linkedDoc ? escapeHTML(linkedDoc.codigo) : '—'}</strong></div></div><p class="detail-description">${escapeHTML(t.descricao || 'Sem descrição.')}</p><div class="movement-panel"><h4>Atualizar tarefa</h4><label class="form-group"><span class="form-label">Novo status</span><select class="form-control" id="task-detail-status">${optionList(TASK_STATUS,t.status)}</select></label><label class="form-group"><span class="form-label">Comentário / atualização</span><textarea class="form-control" id="task-detail-note" rows="2" maxlength="1000"></textarea></label><div class="modal-actions"><button class="btn btn-secondary" onclick="editarTarefa('${t.id}')">Editar dados</button><button class="btn btn-primary" onclick="atualizarStatusTarefa('${t.id}')">Registrar atualização</button></div></div><div class="history-panel"><h4>Histórico</h4><ol>${history}</ol></div>`;
  document.getElementById('modal-detalhe-tarefa').classList.add('active');
}

function atualizarStatusTarefa(id) {
  const t = DB.tarefasInternas.find(item=>item.id===id);
  if (!t) return;
  const nextStatus = document.getElementById('task-detail-status').value;
  const note = document.getElementById('task-detail-note').value.trim();
  const saved = salvarBancoInterno(() => {
    const changed = t.status !== nextStatus;
    t.status = nextStatus;
    if (nextStatus === 'concluida' && !t.concluidaEm) t.concluidaEm = new Date().toISOString();
    if (nextStatus !== 'concluida') t.concluidaEm = '';
    t.atualizadoEm = new Date().toISOString();
    registrarHistorico(t, changed ? `Status alterado para ${statusLabel(TASK_STATUS,nextStatus)}` : 'Atualização registrada', note);
  });
  if (!saved) return;
  fecharModal('modal-detalhe-tarefa');
  navigate('tarefas');
  verTarefa(id);
  showToast('Atualização e histórico salvos neste navegador.', 'success');
}

function exportarTarefasInternas() {
  downloadCSV('sigam_tarefas.csv', ['ID','Título','Descrição','Secretaria','Setor','Responsável','Prazo','Prioridade','Status','Concluída em'], DB.tarefasInternas.map(t=>[t.id,t.titulo,t.descricao,t.secretaria,t.setor,t.responsavel,t.prazo,t.prioridade,statusLabel(TASK_STATUS,t.status),t.concluidaEm]));
}

function limparFiltrosInternos(tipo) {
  if (tipo === 'documentos') {
    window.docDashboardFilter = '';
    document.getElementById('docs-search').value = '';
    document.getElementById('docs-secretaria').value = '';
    document.getElementById('docs-status').value = '';
    filtrarDocumentos();
  } else {
    window.taskDashboardFilter = '';
    document.getElementById('tasks-search').value = '';
    document.getElementById('tasks-secretaria').value = '';
    document.getElementById('tasks-status').value = '';
    filtrarTarefas();
  }
}

function buscarGlobal(query) {
  const panel = document.getElementById('global-search-results');
  if (!panel) return;
  const q = query.trim().toLocaleLowerCase('pt-BR');
  if (!q) { panel.hidden = true; panel.innerHTML = ''; return; }
  const docs = DB.documentosInternos.filter(d => d.acesso !== 'restrito' && [d.codigo,d.titulo,d.tipo,d.secretariaAtual,d.responsavel,d.palavrasChave].join(' ').toLocaleLowerCase('pt-BR').includes(q)).slice(0,5).map(d=>({route:'documentos',id:d.id,label:d.titulo,meta:`Documento · ${d.codigo}`}));
  const tasks = DB.tarefasInternas.filter(t => [t.titulo,t.secretaria,t.setor,t.responsavel].join(' ').toLocaleLowerCase('pt-BR').includes(q)).slice(0,5).map(t=>({route:'tarefas',id:t.id,label:t.titulo,meta:`Tarefa · ${t.secretaria}`}));
  const results = [...docs,...tasks].slice(0,8);
  panel.innerHTML = results.length ? results.map(r=>`<button type="button" class="global-search-result" onclick="selecionarResultadoGlobal('${r.route}','${r.id}')"><strong>${escapeHTML(r.label)}</strong><small>${escapeHTML(r.meta)}</small></button>`).join('') : '<p class="global-search-empty">Nenhum resultado interno encontrado.</p>';
  panel.hidden = false;
}

function selecionarResultadoGlobal(route, id) {
  document.getElementById('global-search').value = '';
  document.getElementById('global-search-results').hidden = true;
  navigate(route);
  window.setTimeout(() => route === 'documentos' ? verDocumento(id) : verTarefa(id), 0);
}

document.addEventListener('click', event => {
  const search = document.getElementById('global-search-wrap');
  if (search && !search.contains(event.target)) document.getElementById('global-search-results').hidden = true;
});
