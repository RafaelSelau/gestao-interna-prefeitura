// ===== MÓDULO SERVIÇOS MUNICIPAIS =====

function renderServicos() {
  return `
    <div class="page-header">
      <div class="page-header-info">
        <h2>Serviços Municipais</h2>
        <p>Gerencie solicitações, alvarás, certidões e protocolos</p>
      </div>
      <div class="page-header-actions">
        <button class="btn btn-secondary" onclick="exportarServicos()">Exportar CSV</button>
        <button class="btn btn-primary" onclick="abrirNovoServico()">Nova solicitação</button>
      </div>
    </div>

    <!-- STATS -->
    <div class="grid-4" style="margin-bottom:24px">
      ${[
        { label: 'Total', val: DB.servicos.length, icon: '', color: 'blue' },
        { label: 'Aprovados', val: DB.servicos.filter(s=>s.status==='aprovado').length, icon: '', color: 'emerald' },
        { label: 'Pendentes', val: DB.servicos.filter(s=>['pendente','em_andamento'].includes(s.status)).length, icon: '', color: 'gold' },
        { label: 'Recusados', val: DB.servicos.filter(s=>s.status==='recusado').length, icon: '', color: 'rose' }
      ].map(s => `
        <div class="stat-card ${s.color}">
          <div class="stat-card-header">
            <div class="stat-card-icon ${s.color}">${s.icon}</div>
          </div>
          <div class="stat-value">${s.val}</div>
          <div class="stat-label">${s.label}</div>
        </div>
      `).join('')}
    </div>

    <!-- TIPOS DE SERVIÇO -->
    <div class="grid-3" style="margin-bottom:24px">
      ${[
        { tipo: 'Alvarás', query: 'Alvará', desc: 'Alvará de funcionamento e reformas', count: DB.servicos.filter(s=>s.tipo.includes('Alvará')).length, color: '#3b82f6' },
        { tipo: 'Certidões', query: 'Certidão', desc: 'IPTU, débitos e histórico', count: DB.servicos.filter(s=>s.tipo.includes('Certidão')).length, color: '#10b981' },
        { tipo: 'Licenças', query: 'Licença', desc: 'Licenças de obras e construções', count: DB.servicos.filter(s=>s.tipo.includes('Licença') || s.tipo.includes('Habite')).length, color: '#f59e0b' }
      ].map(s => `
        <div class="card service-type-card" role="button" tabindex="0" aria-label="Filtrar por ${s.tipo}, ${s.count} solicitações" style="border-left:3px solid ${s.color}" onclick="filtrarTipoServico('${s.query}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();filtrarTipoServico('${s.query}')}" >
          <div style="display:flex;align-items:center;gap:14px">
            <div>
              <div style="font-size:16px;font-weight:700;color:var(--text-primary)">${s.tipo}</div>
              <div style="font-size:12px;color:var(--text-muted)">${s.desc}</div>
            </div>
            <div style="margin-left:auto;font-size:28px;font-weight:700;color:${s.color}">${s.count}</div>
          </div>
        </div>
      `).join('')}
    </div>

    <!-- BUSCA E FILTROS -->
    <div class="card" style="margin-bottom:20px">
      <div class="search-bar">
        <div class="search-input-wrap">
          <input type="text" id="search-servicos" placeholder="Buscar por protocolo, cidadão ou tipo..." oninput="window.serviceTypeFilter='';this.placeholder='Buscar por protocolo, cidadão ou tipo...';filtrarServicos()">
        </div>
        <select class="form-control" id="filter-status-srv" style="width:160px" onchange="filtrarServicos()">
          <option value="">Todos os Status</option>
          <option value="aprovado">Aprovado</option>
          <option value="em_andamento">Em Andamento</option>
          <option value="pendente">Pendente</option>
          <option value="recusado">Recusado</option>
        </select>
        <select class="form-control" id="filter-secretaria-srv" style="width:200px" onchange="filtrarServicos()">
          <option value="">Todas as Secretarias</option>
          ${[...new Set(DB.servicos.map(s=>s.responsavel))].map(r=>`<option value="${r}">${r}</option>`).join('')}
        </select>
        <button class="btn btn-secondary" type="button" onclick="limparFiltrosServicos()">Limpar filtros</button>
      </div>
    </div>

    <!-- TABELA SERVIÇOS -->
    <div class="card">
      <div class="card-header">
        <div class="card-title">Solicitações de Serviço</div>
        <span id="total-srv-filtrado" style="font-size:12px;color:var(--text-muted)">${DB.servicos.length} registros</span>
      </div>
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Protocolo</th>
              <th>Cidadão</th>
              <th>Tipo de Serviço</th>
              <th>Responsável</th>
              <th>Valor</th>
              <th>Prazo</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody id="tbody-servicos">
            ${renderTabelaServicos(DB.servicos)}
          </tbody>
        </table>
      </div>
    </div>

    <!-- MODAL NOVO SERVIÇO -->
    <div class="modal-overlay" id="modal-servico">
      <div class="modal">
        <div class="modal-header">
          <h3 class="modal-title" id="modal-srv-title">Nova Solicitação</h3>
          <button class="modal-close" onclick="fecharModal('modal-servico')">✕</button>
        </div>
        <form id="form-servico" onsubmit="salvarServico(event)">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Cidadão *</label>
              <select class="form-control" id="srv-cidadao" required>
                <option value="">Selecione o cidadão</option>
                ${DB.cidadaos.map(c=>`<option value="${escapeHTML(c.nome)}">${escapeHTML(c.nome)}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Tipo de Serviço *</label>
              <select class="form-control" id="srv-tipo" required>
                <option value="">Selecione o tipo</option>
                <option>Alvará de Funcionamento</option>
                <option>Alvará de Reformas</option>
                <option>Certidão de IPTU</option>
                <option>Certidão Negativa</option>
                <option>Certidão Histórica</option>
                <option>Licença de Obra</option>
                <option>Habite-se</option>
                <option>Parcelamento de Débito</option>
                <option>Cadastro Imobiliário</option>
                <option>Isenção de IPTU</option>
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Secretaria Responsável</label>
              <select class="form-control" id="srv-responsavel">
                ${DB.secretarias.map(s=>`<option value="${escapeHTML(s.nome.replace('Secretaria de ','Sec. '))}">${escapeHTML(s.nome)}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Valor (R$)</label>
              <input type="number" class="form-control" id="srv-valor" placeholder="0,00" step="0.01" min="0">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Data de Entrada</label>
              <input type="date" class="form-control" id="srv-data" value="${new Date().toISOString().slice(0,10)}">
            </div>
            <div class="form-group">
              <label class="form-label">Prazo de Conclusão</label>
              <input type="date" class="form-control" id="srv-prazo">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Descrição / Observações</label>
            <textarea class="form-control" id="srv-descricao" placeholder="Detalhes da solicitação..."></textarea>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Status</label>
              <select class="form-control" id="srv-status">
                <option value="pendente">Pendente</option>
                <option value="em_andamento">Em Andamento</option>
                <option value="aprovado">Aprovado</option>
                <option value="recusado">Recusado</option>
              </select>
            </div>
          </div>
          <input type="hidden" id="srv-id">
          <div style="display:flex;gap:12px;justify-content:flex-end;margin-top:8px">
            <button type="button" class="btn btn-secondary" onclick="fecharModal('modal-servico')">Cancelar</button>
            <button type="submit" class="btn btn-primary">Salvar solicitação</button>
          </div>
        </form>
      </div>
    </div>

    <div class="modal-overlay" id="modal-detalhe-servico">
      <section class="modal" role="dialog" aria-modal="true" aria-labelledby="titulo-detalhe-servico">
        <div class="modal-header"><h3 class="modal-title" id="titulo-detalhe-servico">Detalhes da solicitação</h3><button class="modal-close" type="button" aria-label="Fechar" onclick="fecharModal('modal-detalhe-servico')">×</button></div>
        <div id="conteudo-detalhe-servico"></div>
        <div class="modal-actions"><button class="btn btn-secondary" type="button" onclick="fecharModal('modal-detalhe-servico')">Fechar</button><button class="btn btn-primary" id="editar-detalhe-servico" type="button">Editar solicitação</button></div>
      </section>
    </div>
  `;
}

function renderTabelaServicos(lista) {
  if (!lista.length) return '<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text-muted)">Nenhuma solicitação encontrada</td></tr>';
  return lista.map(s => `
    <tr>
      <td><span style="font-family:monospace;font-size:12px;color:var(--primary-300)">${escapeHTML(s.protocolo)}</span></td>
      <td>${escapeHTML(s.cidadao)}</td>
      <td>${escapeHTML(s.tipo)}</td>
      <td style="font-size:12px">${escapeHTML(s.responsavel)}</td>
      <td>${s.valor > 0 ? formatCurrency(s.valor) : '<span style="color:var(--text-muted)">Gratuito</span>'}</td>
      <td style="font-size:12px">${formatDate(s.prazo)}</td>
      <td>${getStatusBadge(s.status)}</td>
      <td>
        <div style="display:flex;gap:6px">
          <button type="button" class="btn btn-secondary btn-sm" onclick="verDetalhesServico('${s.id}')" aria-label="Ver detalhes da solicitação ${escapeHTML(s.protocolo)}">Detalhes</button>
          <button type="button" class="btn btn-secondary btn-sm" onclick="editarServico('${s.id}')" aria-label="Editar solicitação ${escapeHTML(s.protocolo)}">Editar</button>
          <button type="button" class="btn btn-danger btn-sm" onclick="excluirServico('${s.id}')" aria-label="Excluir solicitação ${escapeHTML(s.protocolo)}">Excluir</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function filtrarServicos() {
  const search = document.getElementById('search-servicos').value.toLowerCase();
  const status = document.getElementById('filter-status-srv').value;
  const secretaria = document.getElementById('filter-secretaria-srv').value;
  const typeFilter = window.serviceTypeFilter || '';

  let lista = DB.servicos.filter(s => {
    const matchSearch = !search || s.protocolo.toLowerCase().includes(search) || s.cidadao.toLowerCase().includes(search) || s.tipo.toLowerCase().includes(search);
    const matchType = !typeFilter || (typeFilter === 'Licença' ? s.tipo.includes('Licença') || s.tipo.includes('Habite') : s.tipo.toLocaleLowerCase('pt-BR').includes(typeFilter.toLocaleLowerCase('pt-BR')));
    const matchStatus = !status || s.status === status;
    const matchSec = !secretaria || s.responsavel === secretaria;
    return matchSearch && matchType && matchStatus && matchSec;
  });

  document.getElementById('tbody-servicos').innerHTML = renderTabelaServicos(lista);
  document.getElementById('total-srv-filtrado').textContent = `${lista.length} registros`;
}

function filtrarTipoServico(tipo) {
  const input = document.getElementById('search-servicos');
  if (input) { window.serviceTypeFilter = tipo; input.value = ''; const label = ({ 'Alvará': 'Alvarás', 'Certidão': 'Certidões', 'Licença': 'Licenças' })[tipo] || tipo; input.placeholder = `Filtro: ${label} · digite para pesquisar`; filtrarServicos(); }
}

function limparFiltrosServicos() {
  window.serviceTypeFilter = '';
  document.getElementById('search-servicos').value = '';
  document.getElementById('search-servicos').placeholder = 'Buscar por protocolo, cidadão ou tipo...';
  document.getElementById('filter-status-srv').value = '';
  document.getElementById('filter-secretaria-srv').value = '';
  filtrarServicos();
}

function abrirNovoServico() {
  document.getElementById('modal-srv-title').textContent = 'Nova Solicitação';
  document.getElementById('form-servico').reset();
  document.getElementById('srv-id').value = '';
  document.getElementById('modal-servico').classList.add('active');
}

function editarServico(id) {
  const s = DB.servicos.find(x => x.id === id);
  if (!s) return;
  document.getElementById('modal-srv-title').textContent = 'Editar solicitação';
  document.getElementById('srv-id').value = s.id;
  document.getElementById('srv-cidadao').value = s.cidadao;
  document.getElementById('srv-tipo').value = s.tipo;
  document.getElementById('srv-responsavel').value = s.responsavel;
  document.getElementById('srv-valor').value = s.valor;
  document.getElementById('srv-data').value = s.data;
  document.getElementById('srv-prazo').value = s.prazo;
  document.getElementById('srv-descricao').value = s.descricao;
  document.getElementById('srv-status').value = s.status;
  document.getElementById('modal-servico').classList.add('active');
}

function salvarServico(e) {
  e.preventDefault();
  const id = document.getElementById('srv-id').value;
  const num = String(Math.max(0, ...DB.servicos.map(item => Number((item.protocolo || '').match(/(\d+)$/)?.[1]) || 0)) + 1).padStart(6, '0');
  const data = {
    cidadao: document.getElementById('srv-cidadao').value,
    tipo: document.getElementById('srv-tipo').value,
    responsavel: document.getElementById('srv-responsavel').value,
    valor: parseFloat(document.getElementById('srv-valor').value) || 0,
    data: document.getElementById('srv-data').value,
    prazo: document.getElementById('srv-prazo').value,
    descricao: document.getElementById('srv-descricao').value,
    status: document.getElementById('srv-status').value
  };

  const saved = salvarAlteracaoComRollback(() => {
    if (id) {
      const idx = DB.servicos.findIndex(s => s.id === id);
      if (idx < 0) throw new Error('A solicitação não foi encontrada.');
      DB.servicos[idx] = { ...DB.servicos[idx], ...data };
    } else {
      DB.servicos.unshift({ id: generateId('SRV', DB.servicos), protocolo: `PREF-${new Date().getFullYear()}-${num}`, ...data });
    }
  });
  if (!saved) return;
  fecharModal('modal-servico');
  showToast(id ? 'Solicitação atualizada.' : 'Solicitação protocolada com sucesso.', 'success');
  navigate('servicos');
}

function excluirServico(id) {
  if (confirm('Excluir esta solicitação?')) {
    if (!salvarAlteracaoComRollback(() => { DB.servicos = DB.servicos.filter(s => s.id !== id); })) return;
    showToast('Solicitação excluída.', 'info');
    navigate('servicos');
  }
}

function verDetalhesServico(id) {
  const s = DB.servicos.find(x => x.id === id);
  if (!s) return;
  document.getElementById('conteudo-detalhe-servico').innerHTML = `<div class="detail-grid"><div><small>Protocolo</small><strong>${escapeHTML(s.protocolo)}</strong></div><div><small>Cidadão</small><strong>${escapeHTML(s.cidadao)}</strong></div><div><small>Tipo</small><strong>${escapeHTML(s.tipo)}</strong></div><div><small>Situação</small><strong>${getStatusBadge(s.status)}</strong></div><div><small>Valor</small><strong>${s.valor > 0 ? formatCurrency(s.valor) : 'Gratuito'}</strong></div><div><small>Data de entrada</small><strong>${formatDate(s.data)}</strong></div><div><small>Prazo</small><strong>${formatDate(s.prazo)}</strong></div><div><small>Secretaria responsável</small><strong>${escapeHTML(s.responsavel)}</strong></div></div><div class="detail-description"><strong>Descrição</strong><br>${escapeHTML(s.descricao || 'Nenhuma descrição informada.')}</div>`;
  document.getElementById('editar-detalhe-servico').onclick = () => { fecharModal('modal-detalhe-servico'); editarServico(id); };
  document.getElementById('modal-detalhe-servico').classList.add('active');
}

function exportarServicos() {
  downloadCSV('servicos_municipais.csv', ['ID', 'Protocolo', 'Cidadão', 'Tipo', 'Status', 'Data', 'Prazo', 'Responsável', 'Valor', 'Descrição'],
    DB.servicos.map(s => [s.id, s.protocolo, s.cidadao, s.tipo, s.status, s.data, s.prazo, s.responsavel, s.valor, s.descricao]));
}
