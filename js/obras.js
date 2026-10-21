// ===== MÓDULO OBRAS =====

function renderObras() {
  const emAndamento = DB.obras.filter(o => o.status === 'em_andamento');
  const concluidas = DB.obras.filter(o => o.status === 'concluida');
  const totalInvestimento = DB.obras.reduce((acc, o) => acc + o.investimento, 0);

  return `
    <div class="page-header">
      <div class="page-header-info">
        <h2>Obras e infraestrutura</h2>
        <p>${DB.obras.length} obras cadastradas • Investimento total: ${formatCurrency(totalInvestimento)}</p>
      </div>
      <div class="page-header-actions">
        <button class="btn btn-secondary" onclick="exportarObras()">Exportar CSV</button>
        <button class="btn btn-primary" onclick="abrirModalObra()">Nova obra</button>
      </div>
    </div>

    <!-- STATS OBRAS -->
    <div class="grid-4" style="margin-bottom:24px">
      ${[
        { label: 'Em Andamento', val: emAndamento.length, icon: '', color: 'blue' },
        { label: 'Concluídas', val: concluidas.length, icon: '', color: 'emerald' },
        { label: 'Planejadas', val: DB.obras.filter(o=>o.status==='planejado'||o.status==='licitacao').length, icon: '', color: 'gold' },
        { label: 'Investimento Total', icon: '', color: 'purple', isVal: true, val: 'R$ ' + (totalInvestimento/1000000).toFixed(1) + 'M' }
      ].map(s => `
        <div class="stat-card ${s.color}">
          <div class="stat-card-header">
            <div class="stat-card-icon ${s.color}">${s.icon}</div>
          </div>
          <div class="stat-value" style="${s.isVal ? 'font-size:22px' : ''}">${s.val}</div>
          <div class="stat-label">${s.label}</div>
        </div>
      `).join('')}
    </div>

    <!-- OBRAS EM ANDAMENTO - CARDS COM PROGRESSO -->
    <div style="margin-bottom:24px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <h3 style="font-family:var(--font-display);font-size:18px;font-weight:600;color:var(--text-primary)">Em andamento</h3>
      </div>
      <div class="grid-3">
        ${emAndamento.map(obra => `
          <div class="card obra-card-link" role="button" tabindex="0" aria-label="Abrir detalhes de ${escapeHTML(obra.nome)}" onclick="verDetalhesObra('${obra.id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();verDetalhesObra('${obra.id}')}" >
            <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:16px">
              <div>
                <div style="font-size:15px;font-weight:600;color:var(--text-primary);margin-bottom:4px">${escapeHTML(obra.nome)}</div>
                <div style="font-size:12px;color:var(--text-muted)">${escapeHTML(obra.tipo)} • ${escapeHTML(obra.bairro)}</div>
              </div>
              <span style="font-size:22px;font-weight:800;color:var(--primary-300)">${obra.progresso}%</span>
            </div>
            <div class="progress-bar" style="margin-bottom:12px">
              <div class="progress-fill" style="width:${obra.progresso}%;background:${obra.progresso>70?'linear-gradient(90deg,#065f46,#10b981)':obra.progresso>40?'linear-gradient(90deg,#1e3a7a,#3b82f6)':'linear-gradient(90deg,#92400e,#f59e0b)'}"></div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px">
              <div style="color:var(--text-muted)"><small class="table-secondary">Investimento</small>${formatCurrency(obra.investimento)}</div>
              <div style="color:var(--text-muted)"><small class="table-secondary">Previsão de término</small>${formatDate(obra.fim_previsto)}</div>
              <div style="color:var(--text-muted)"><small class="table-secondary">Empresa contratada</small>${escapeHTML(obra.contratada.length > 20 ? obra.contratada.slice(0,18)+'...' : obra.contratada)}</div>
              <div>${getStatusBadge(obra.status)}</div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- TODAS AS OBRAS - TABELA -->
    <div class="card">
      <div class="card-header">
        <div class="card-title"> Todas as Obras</div>
        <div style="display:flex;gap:8px">
          <select class="form-control" id="filter-status-obra" style="width:160px" onchange="filtrarObras()">
            <option value="">Todos os Status</option>
            <option value="em_andamento">Em Andamento</option>
            <option value="concluida">Concluída</option>
            <option value="planejado">Planejado</option>
            <option value="licitacao">Licitação</option>
          </select>
        </div>
      </div>
      <div class="table-wrapper">
        <table class="data-table" id="tabela-obras">
          <thead>
            <tr>
              <th>Obra</th>
              <th>Tipo</th>
              <th>Bairro</th>
              <th>Investimento</th>
              <th>Progresso</th>
              <th>Prazo</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody id="tbody-obras">
            ${renderTabelaObras(DB.obras)}
          </tbody>
        </table>
      </div>
    </div>

    <!-- MODAL OBRA -->
    <div class="modal-overlay" id="modal-obra">
      <div class="modal" style="max-width:700px">
        <div class="modal-header">
          <h3 class="modal-title" id="modal-obra-title">Nova obra</h3>
          <button class="modal-close" onclick="fecharModal('modal-obra')">✕</button>
        </div>
        <form id="form-obra" onsubmit="salvarObra(event)">
          <div class="form-group">
            <label class="form-label">Nome da Obra *</label>
            <input type="text" class="form-control" id="obra-nome" placeholder="Nome descritivo da obra" required>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Tipo</label>
              <select class="form-control" id="obra-tipo">
                <option>Infraestrutura Viária</option>
                <option>Saúde</option>
                <option>Educação</option>
                <option>Lazer e Esporte</option>
                <option>Saneamento</option>
                <option>Cultura e Comércio</option>
                <option>Habitação</option>
                <option>Meio Ambiente</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Bairro</label>
              <input type="text" class="form-control" id="obra-bairro" placeholder="Bairro da obra">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Investimento (R$)</label>
              <input type="number" class="form-control" id="obra-investimento" placeholder="0,00" step="1000">
            </div>
            <div class="form-group">
              <label class="form-label">Empresa Contratada</label>
              <input type="text" class="form-control" id="obra-contratada" placeholder="Nome da empresa">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Data de Início</label>
              <input type="date" class="form-control" id="obra-inicio">
            </div>
            <div class="form-group">
              <label class="form-label">Previsão de Término</label>
              <input type="date" class="form-control" id="obra-fim">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Progresso (%)</label>
              <input type="number" class="form-control" id="obra-progresso" placeholder="0" min="0" max="100">
            </div>
            <div class="form-group">
              <label class="form-label">Status</label>
              <select class="form-control" id="obra-status">
                <option value="planejado">Planejado</option>
                <option value="licitacao">Em Licitação</option>
                <option value="em_andamento">Em Andamento</option>
                <option value="concluida">Concluída</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Descrição</label>
            <textarea class="form-control" id="obra-descricao" placeholder="Descrição detalhada da obra"></textarea>
          </div>
          <input type="hidden" id="obra-id">
          <div style="display:flex;gap:12px;justify-content:flex-end;margin-top:8px">
            <button type="button" class="btn btn-secondary" onclick="fecharModal('modal-obra')">Cancelar</button>
            <button type="submit" class="btn btn-primary">Salvar Obra</button>
          </div>
        </form>
      </div>
    </div>

    <!-- MODAL DETALHES OBRA -->
    <div class="modal-overlay" id="modal-detalhes-obra">
      <div class="modal" style="max-width:650px">
        <div class="modal-header">
          <h3 class="modal-title">Detalhes da Obra</h3>
          <button class="modal-close" onclick="fecharModal('modal-detalhes-obra')">✕</button>
        </div>
        <div id="detalhes-obra-content"></div>
      </div>
    </div>
  `;
}

function renderTabelaObras(lista) {
  if (!lista.length) return '<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text-muted)">Nenhuma obra encontrada</td></tr>';
  return lista.map(o => `
    <tr>
      <td style="font-weight:500;color:var(--text-primary)">${escapeHTML(o.nome)}</td>
      <td style="font-size:12px">${escapeHTML(o.tipo)}</td>
      <td>${escapeHTML(o.bairro)}</td>
      <td style="font-weight:600;color:var(--accent-gold-light)">${formatCurrency(o.investimento)}</td>
      <td>
        <div style="display:flex;align-items:center;gap:8px;min-width:100px">
          <div class="progress-bar" style="width:60px"><div class="progress-fill" style="width:${o.progresso}%"></div></div>
          <span style="font-size:12px;color:var(--text-muted)">${o.progresso}%</span>
        </div>
      </td>
      <td style="font-size:12px">${formatDate(o.fim_previsto)}</td>
      <td>${getStatusBadge(o.status)}</td>
      <td>
        <div style="display:flex;gap:6px">
          <button type="button" class="btn btn-secondary btn-sm" aria-label="Ver detalhes de ${escapeHTML(o.nome)}" onclick="verDetalhesObra('${o.id}')">Detalhes</button>
          <button type="button" class="btn btn-secondary btn-sm" aria-label="Editar ${escapeHTML(o.nome)}" onclick="editarObra('${o.id}')">Editar</button>
          <button type="button" class="btn btn-danger btn-sm" aria-label="Excluir ${escapeHTML(o.nome)}" onclick="excluirObra('${o.id}')">Excluir</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function filtrarObras() {
  const status = document.getElementById('filter-status-obra').value;
  const lista = status ? DB.obras.filter(o => o.status === status) : DB.obras;
  document.getElementById('tbody-obras').innerHTML = renderTabelaObras(lista);
}

function abrirModalObra(id = null) {
  document.getElementById('modal-obra-title').textContent = id ? 'Editar obra' : 'Nova obra';
  document.getElementById('form-obra').reset();
  document.getElementById('obra-id').value = '';
  if (id) {
    const o = DB.obras.find(x => x.id === id);
    if (o) {
      document.getElementById('obra-id').value = o.id;
      document.getElementById('obra-nome').value = o.nome;
      document.getElementById('obra-tipo').value = o.tipo;
      document.getElementById('obra-bairro').value = o.bairro;
      document.getElementById('obra-investimento').value = o.investimento;
      document.getElementById('obra-contratada').value = o.contratada;
      document.getElementById('obra-inicio').value = o.inicio;
      document.getElementById('obra-fim').value = o.fim_previsto;
      document.getElementById('obra-progresso').value = o.progresso;
      document.getElementById('obra-status').value = o.status;
      document.getElementById('obra-descricao').value = o.descricao;
    }
  }
  document.getElementById('modal-obra').classList.add('active');
}

function editarObra(id) { abrirModalObra(id); }

function salvarObra(e) {
  e.preventDefault();
  const id = document.getElementById('obra-id').value;
  const data = {
    nome: document.getElementById('obra-nome').value,
    tipo: document.getElementById('obra-tipo').value,
    bairro: document.getElementById('obra-bairro').value,
    investimento: parseFloat(document.getElementById('obra-investimento').value) || 0,
    contratada: document.getElementById('obra-contratada').value,
    inicio: document.getElementById('obra-inicio').value,
    fim_previsto: document.getElementById('obra-fim').value,
    progresso: parseInt(document.getElementById('obra-progresso').value) || 0,
    status: document.getElementById('obra-status').value,
    descricao: document.getElementById('obra-descricao').value,
    secretaria: 'Sec. Obras',
    responsavel: 'Eng. Ricardo Torres'
  };

  const saved = salvarAlteracaoComRollback(() => {
    if (id) {
      const idx = DB.obras.findIndex(o => o.id === id);
      if (idx < 0) throw new Error('A obra não foi encontrada.');
      DB.obras[idx] = { ...DB.obras[idx], ...data };
    } else {
      DB.obras.unshift({ id: generateId('OBR', DB.obras), ...data });
    }
  });
  if (!saved) return;
  fecharModal('modal-obra');
  showToast(id ? 'Obra atualizada.' : 'Obra cadastrada.', 'success');
  navigate('obras');
}

function excluirObra(id) {
  if (confirm('Excluir esta obra?')) {
    if (!salvarAlteracaoComRollback(() => { DB.obras = DB.obras.filter(o => o.id !== id); })) return;
    showToast('Obra excluída.', 'info');
    navigate('obras');
  }
}

function verDetalhesObra(id) {
  const o = DB.obras.find(x => x.id === id);
  if (!o) return;

  document.getElementById('detalhes-obra-content').innerHTML = `
    <div style="display:grid;gap:16px">
      <div style="padding:20px;background:var(--bg-glass);border-radius:12px;border:1px solid var(--border-subtle)">
        <div style="font-size:20px;font-weight:700;color:var(--text-primary);margin-bottom:8px">${escapeHTML(o.nome)}</div>
        <div style="font-size:13px;color:var(--text-secondary);margin-bottom:12px">${escapeHTML(o.descricao)}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">${getStatusBadge(o.status)}<span class="badge badge-info">${escapeHTML(o.tipo)}</span></div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <span style="font-size:14px;color:var(--text-secondary)">Progresso Geral</span>
        <span style="font-size:24px;font-weight:700;color:var(--primary-300)">${o.progresso}%</span>
      </div>
      <div class="progress-bar" style="height:12px;margin-bottom:16px">
        <div class="progress-fill" style="width:${o.progresso}%"></div>
      </div>
      <div class="grid-2">
        ${[
          [' Investimento', formatCurrency(o.investimento)],
          [' Início', formatDate(o.inicio)],
          [' Previsão de Término', formatDate(o.fim_previsto)],
          [' Empresa Contratada', o.contratada],
          [' Bairro/Local', o.bairro],
          [' Responsável', o.responsavel]
        ].map(([l,v]) => `
          <div style="padding:12px;background:var(--bg-glass);border-radius:8px;border:1px solid var(--border-subtle)">
            <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">${l}</div>
            <div style="font-size:14px;font-weight:500;color:var(--text-primary)">${escapeHTML(v)}</div>
          </div>
        `).join('')}
      </div>
      <div style="display:flex;gap:12px;justify-content:flex-end;margin-top:8px">
        <button class="btn btn-secondary" onclick="fecharModal('modal-detalhes-obra')">Fechar</button>
        <button class="btn btn-primary" onclick="fecharModal('modal-detalhes-obra');editarObra('${o.id}')">Editar</button>
      </div>
    </div>
  `;

  document.getElementById('modal-detalhes-obra').classList.add('active');
}

function exportarObras() {
  downloadCSV('obras_municipais.csv', ['ID', 'Nome', 'Tipo', 'Secretaria', 'Status', 'Progresso', 'Investimento', 'Início', 'Previsão', 'Contratada', 'Bairro', 'Responsável'],
    DB.obras.map(o => [o.id, o.nome, o.tipo, o.secretaria, o.status, o.progresso, o.investimento, o.inicio, o.fim_previsto, o.contratada, o.bairro, o.responsavel]));
}
