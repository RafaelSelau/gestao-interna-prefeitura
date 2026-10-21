// ===== MÓDULO CIDADÃOS =====

function renderCidadaos() {
  return `
    <div class="page-header">
      <div class="page-header-info">
        <h2>Gestão de cidadãos</h2>
        <p>${DB.cidadaos.length} cidadãos cadastrados no sistema</p>
      </div>
      <div class="page-header-actions">
        <button class="btn btn-secondary" onclick="exportarCidadaos()">Exportar CSV</button>
        <button class="btn btn-primary" id="btn-novo-cidadao" onclick="abrirModalCidadao()">Novo cidadão</button>
      </div>
    </div>

    <!-- STATS RÁPIDOS -->
    <div class="grid-4" style="margin-bottom:24px">
      ${[
        { label: 'Total Cadastrados', val: DB.cidadaos.length, icon: '', color: 'blue' },
        { label: 'Ativos', val: DB.cidadaos.filter(c=>c.status==='ativo').length, icon: '', color: 'emerald' },
        { label: 'Inativos', val: DB.cidadaos.filter(c=>c.status==='inativo').length, icon: '', color: 'rose' },
        { label: 'Pendentes', val: DB.cidadaos.filter(c=>c.status==='pendente').length, icon: '', color: 'gold' }
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

    <!-- FILTROS E BUSCA -->
    <div class="card" style="margin-bottom:20px">
      <div class="search-bar">
        <div class="search-input-wrap">
          <input type="text" id="search-cidadaos" placeholder="Buscar por nome, CPF, e-mail..." oninput="filtrarCidadaos()">
        </div>
        <select class="form-control" id="filter-status-cid" style="width:160px" onchange="filtrarCidadaos()">
          <option value="">Todos os Status</option>
          <option value="ativo">Ativo</option>
          <option value="inativo">Inativo</option>
          <option value="pendente">Pendente</option>
        </select>
        <select class="form-control" id="filter-bairro" style="width:160px" onchange="filtrarCidadaos()">
          <option value="">Todos os Bairros</option>
          ${[...new Set(DB.cidadaos.map(c=>c.bairro))].map(b=>`<option value="${b}">${b}</option>`).join('')}
        </select>
      </div>
    </div>

    <!-- TABELA DE CIDADÃOS -->
    <div class="card">
      <div class="card-header">
        <div class="card-title">Lista de Cidadãos</div>
        <span id="total-cidadaos-filtrado" style="font-size:12px;color:var(--text-muted)">${DB.cidadaos.length} registros</span>
      </div>
      <div class="table-wrapper">
        <table class="data-table" id="tabela-cidadaos">
          <thead>
            <tr>
              <th>ID</th>
              <th>Nome</th>
              <th>CPF</th>
              <th>Bairro</th>
              <th>Telefone</th>
              <th>Status</th>
              <th>Cadastro</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody id="tbody-cidadaos">
            ${renderTabelaCidadaos(DB.cidadaos)}
          </tbody>
        </table>
      </div>
    </div>

    <!-- MODAL CIDADÃO -->
    <div class="modal-overlay" id="modal-cidadao">
      <div class="modal" style="max-width:700px">
        <div class="modal-header">
          <h3 class="modal-title" id="modal-cidadao-title">Novo Cidadão</h3>
          <button class="modal-close" onclick="fecharModal('modal-cidadao')">✕</button>
        </div>
        <form id="form-cidadao" onsubmit="salvarCidadao(event)">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Nome Completo *</label>
              <input type="text" class="form-control" id="cid-nome" placeholder="Nome completo do cidadão" required>
            </div>
            <div class="form-group">
              <label class="form-label">CPF *</label>
              <input type="text" class="form-control" id="cid-cpf" placeholder="000.000.000-00" required>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">RG</label>
              <input type="text" class="form-control" id="cid-rg" placeholder="00.000.000-0">
            </div>
            <div class="form-group">
              <label class="form-label">Data de Nascimento</label>
              <input type="date" class="form-control" id="cid-nascimento">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">E-mail</label>
              <input type="email" class="form-control" id="cid-email" placeholder="email@exemplo.com">
            </div>
            <div class="form-group">
              <label class="form-label">Telefone</label>
              <input type="text" class="form-control" id="cid-telefone" placeholder="(00) 00000-0000">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Endereço</label>
              <input type="text" class="form-control" id="cid-endereco" placeholder="Rua, número">
            </div>
            <div class="form-group">
              <label class="form-label">Bairro</label>
              <input type="text" class="form-control" id="cid-bairro" placeholder="Nome do bairro">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">CEP</label>
              <input type="text" class="form-control" id="cid-cep" placeholder="00000-000">
            </div>
            <div class="form-group">
              <label class="form-label">Status</label>
              <select class="form-control" id="cid-status">
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
                <option value="pendente">Pendente</option>
              </select>
            </div>
          </div>
          <input type="hidden" id="cid-id">
          <div style="display:flex;gap:12px;justify-content:flex-end;margin-top:8px">
            <button type="button" class="btn btn-secondary" onclick="fecharModal('modal-cidadao')">Cancelar</button>
            <button type="submit" class="btn btn-primary">Salvar cidadão</button>
          </div>
        </form>
      </div>
    </div>

    <!-- MODAL DETALHES CIDADÃO -->
    <div class="modal-overlay" id="modal-detalhes-cid">
      <div class="modal" style="max-width:700px">
        <div class="modal-header">
          <h3 class="modal-title">Detalhes do Cidadão</h3>
          <button class="modal-close" onclick="fecharModal('modal-detalhes-cid')">✕</button>
        </div>
        <div id="detalhes-cidadao-content"></div>
      </div>
    </div>
  `;
}

function renderTabelaCidadaos(lista) {
  if (!lista.length) return '<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text-muted)">Nenhum cidadão encontrado</td></tr>';
  return lista.map(c => `
    <tr>
      <td><span style="font-family:monospace;font-size:12px;color:var(--text-muted)">${escapeHTML(c.id)}</span></td>
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:32px;height:32px;background:var(--gradient-primary);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:white;flex-shrink:0">${escapeHTML(c.nome.split(' ').map(n=>n[0]).slice(0,2).join(''))}</div>
          <div>
            <div style="font-weight:500;color:var(--text-primary)">${escapeHTML(c.nome)}</div>
            <div style="font-size:11px;color:var(--text-muted)">${escapeHTML(c.email)}</div>
          </div>
        </div>
      </td>
      <td style="font-family:monospace">${escapeHTML(c.cpf)}</td>
      <td>${escapeHTML(c.bairro)}</td>
      <td>${escapeHTML(c.telefone)}</td>
      <td>${getStatusBadge(c.status)}</td>
      <td>${formatDate(c.cadastro)}</td>
      <td>
        <div style="display:flex;gap:6px">
          <button type="button" class="btn btn-secondary btn-sm" aria-label="Ver detalhes de ${escapeHTML(c.nome)}" onclick="verDetalhesCidadao('${c.id}')">Detalhes</button>
          <button type="button" class="btn btn-secondary btn-sm" aria-label="Editar ${escapeHTML(c.nome)}" onclick="editarCidadao('${c.id}')">Editar</button>
          <button type="button" class="btn btn-danger btn-sm" aria-label="Excluir ${escapeHTML(c.nome)}" onclick="excluirCidadao('${c.id}')">Excluir</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function filtrarCidadaos() {
  const search = document.getElementById('search-cidadaos').value.toLowerCase();
  const status = document.getElementById('filter-status-cid').value;
  const bairro = document.getElementById('filter-bairro').value;

  let lista = DB.cidadaos.filter(c => {
    const matchSearch = !search || c.nome.toLowerCase().includes(search) || c.cpf.includes(search) || c.email.toLowerCase().includes(search);
    const matchStatus = !status || c.status === status;
    const matchBairro = !bairro || c.bairro === bairro;
    return matchSearch && matchStatus && matchBairro;
  });

  document.getElementById('tbody-cidadaos').innerHTML = renderTabelaCidadaos(lista);
  document.getElementById('total-cidadaos-filtrado').textContent = `${lista.length} registros`;
}

function abrirModalCidadao(id = null) {
  const modal = document.getElementById('modal-cidadao');
  document.getElementById('modal-cidadao-title').textContent = id ? 'Editar cidadão' : 'Novo cidadão';
  document.getElementById('form-cidadao').reset();
  document.getElementById('cid-id').value = '';

  if (id) {
    const c = DB.cidadaos.find(x => x.id === id);
    if (c) {
      document.getElementById('cid-id').value = c.id;
      document.getElementById('cid-nome').value = c.nome;
      document.getElementById('cid-cpf').value = c.cpf;
      document.getElementById('cid-rg').value = c.rg;
      document.getElementById('cid-nascimento').value = c.nascimento;
      document.getElementById('cid-email').value = c.email;
      document.getElementById('cid-telefone').value = c.telefone;
      document.getElementById('cid-endereco').value = c.endereco;
      document.getElementById('cid-bairro').value = c.bairro;
      document.getElementById('cid-cep').value = c.cep;
      document.getElementById('cid-status').value = c.status;
    }
  }

  modal.classList.add('active');
}

function editarCidadao(id) { abrirModalCidadao(id); }

function salvarCidadao(e) {
  e.preventDefault();
  const id = document.getElementById('cid-id').value;
  const data = {
    nome: document.getElementById('cid-nome').value,
    cpf: document.getElementById('cid-cpf').value,
    rg: document.getElementById('cid-rg').value,
    nascimento: document.getElementById('cid-nascimento').value,
    email: document.getElementById('cid-email').value,
    telefone: document.getElementById('cid-telefone').value,
    endereco: document.getElementById('cid-endereco').value,
    bairro: document.getElementById('cid-bairro').value,
    cep: document.getElementById('cid-cep').value,
    status: document.getElementById('cid-status').value
  };

  const saved = salvarAlteracaoComRollback(() => {
    if (id) {
      const idx = DB.cidadaos.findIndex(c => c.id === id);
      if (idx < 0) throw new Error('O cidadão não foi encontrado.');
      DB.cidadaos[idx] = { ...DB.cidadaos[idx], ...data };
    } else {
      DB.cidadaos.unshift({ id: generateId('CID', DB.cidadaos), ...data, cadastro: new Date().toISOString().slice(0,10) });
    }
  });
  if (!saved) return;
  fecharModal('modal-cidadao');
  showToast(id ? 'Cidadão atualizado com sucesso.' : 'Cidadão cadastrado com sucesso.', 'success');
  navigate('cidadaos');
}

function excluirCidadao(id) {
  if (confirm('Tem certeza que deseja excluir este cidadão? Esta ação não pode ser desfeita.')) {
    if (!salvarAlteracaoComRollback(() => { DB.cidadaos = DB.cidadaos.filter(c => c.id !== id); })) return;
    showToast('Cidadão excluído.', 'info');
    navigate('cidadaos');
  }
}

function verDetalhesCidadao(id) {
  const c = DB.cidadaos.find(x => x.id === id);
  if (!c) return;

  const servicosDoCidadao = DB.servicos.filter(s => s.cidadao === c.nome);
  const protocolosDoCidadao = DB.protocolos.filter(p => p.cidadao === c.nome);

  document.getElementById('detalhes-cidadao-content').innerHTML = `
    <div style="display:flex;align-items:center;gap:16px;margin-bottom:24px;padding:20px;background:var(--bg-glass);border-radius:12px;border:1px solid var(--border-subtle)">
      <div style="width:64px;height:64px;background:var(--gradient-primary);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700;color:white;flex-shrink:0">${escapeHTML(c.nome.split(' ').map(n=>n[0]).slice(0,2).join(''))}</div>
      <div>
        <div style="font-size:20px;font-weight:700;color:var(--text-primary)">${escapeHTML(c.nome)}</div>
        <div style="font-size:13px;color:var(--text-secondary)">${escapeHTML(c.email)} • ${escapeHTML(c.telefone)}</div>
        <div style="margin-top:8px">${getStatusBadge(c.status)}</div>
      </div>
    </div>

    <div class="grid-2" style="margin-bottom:20px">
      ${[
        [' CPF', c.cpf],
        [' RG', c.rg],
        [' Nascimento', formatDate(c.nascimento)],
        [' Bairro', c.bairro],
        [' Endereço', c.endereco],
        [' CEP', c.cep],
        [' Cadastro', formatDate(c.cadastro)],
        [' ID', c.id]
      ].map(([label, val]) => `
        <div style="padding:12px;background:var(--bg-glass);border-radius:8px;border:1px solid var(--border-subtle)">
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">${label}</div>
          <div style="font-size:14px;color:var(--text-primary);font-weight:500">${escapeHTML(val || '-')}</div>
        </div>
      `).join('')}
    </div>

    <div style="margin-bottom:16px">
      <div style="font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:12px"> Serviços Solicitados (${servicosDoCidadao.length})</div>
      ${servicosDoCidadao.length ? servicosDoCidadao.map(s => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--bg-glass);border-radius:8px;border:1px solid var(--border-subtle);margin-bottom:8px">
          <div>
            <div style="font-size:13px;font-weight:500;color:var(--text-primary)">${escapeHTML(s.tipo)}</div>
            <div style="font-size:11px;color:var(--text-muted)">${escapeHTML(s.protocolo)} • ${formatDate(s.data)}</div>
          </div>
          ${getStatusBadge(s.status)}
        </div>
      `).join('') : '<div style="color:var(--text-muted);font-size:13px;padding:12px 0">Nenhum serviço solicitado.</div>'}
    </div>
  `;

  document.getElementById('modal-detalhes-cid').classList.add('active');
}

function exportarCidadaos() {
  downloadCSV('cidadaos.csv', ['ID', 'Nome', 'CPF', 'RG', 'Nascimento', 'E-mail', 'Telefone', 'Endereço', 'Bairro', 'CEP', 'Status', 'Cadastro'],
    DB.cidadaos.map(c => [c.id, c.nome, c.cpf, c.rg, c.nascimento, c.email, c.telefone, c.endereco, c.bairro, c.cep, c.status, c.cadastro]));
}
