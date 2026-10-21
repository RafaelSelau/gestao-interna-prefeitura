// ===== MÓDULO FINANCEIRO =====

function renderFinanceiro() {
  const orc = DB.orcamento;
  const percExec = orc.total > 0 ? ((orc.executado / orc.total) * 100).toFixed(1) : '0.0';
  const percArr = orc.total > 0 ? ((orc.arrecadado / orc.total) * 100).toFixed(1) : '0.0';

  return `
    <div class="page-header">
      <div class="page-header-info">
        <h2>Gestão Financeira</h2>
        <p>Dados financeiros de demonstração • período de referência 2024</p>
      </div>
      <div class="page-header-actions">
        <button class="btn btn-secondary" onclick="gerarRelatorioFin()">Relatório</button>
        <button class="btn btn-primary" onclick="abrirLancamento()">Novo Lançamento</button>
      </div>
    </div>

    <!-- KPIs FINANCEIROS -->
    <div class="grid-4" style="margin-bottom:24px">
      <div class="stat-card" style="background:linear-gradient(135deg,rgba(37,99,235,0.15),rgba(6,182,212,0.1))">
        <div class="stat-card-header">
          <div class="stat-card-icon blue"></div>
          <span class="stat-change">Base demonstrativa</span>
        </div>
        <div class="stat-value" style="font-size:24px">R$ ${(orc.total/1000000).toFixed(0)}M</div>
        <div class="stat-label">Orçamento Total Aprovado</div>
      </div>
      <div class="stat-card gold" style="background:linear-gradient(135deg,rgba(16,185,129,0.15),rgba(52,211,153,0.1))">
        <div class="stat-card-header">
          <div class="stat-card-icon emerald"></div>
          <span class="stat-change up">${percArr}%</span>
        </div>
        <div class="stat-value" style="font-size:24px">R$ ${(orc.arrecadado/1000000).toFixed(1)}M</div>
        <div class="stat-label">Total Arrecadado</div>
      </div>
      <div class="stat-card rose" style="background:linear-gradient(135deg,rgba(245,158,11,0.15),rgba(251,191,36,0.1))">
        <div class="stat-card-header">
          <div class="stat-card-icon gold"></div>
          <span class="stat-change up">${percExec}%</span>
        </div>
        <div class="stat-value" style="font-size:24px">R$ ${(orc.executado/1000000).toFixed(1)}M</div>
        <div class="stat-label">Total Executado</div>
      </div>
      <div class="stat-card" style="background:linear-gradient(135deg,rgba(139,92,246,0.15),rgba(167,139,250,0.1))">
        <div class="stat-card-header">
          <div class="stat-card-icon purple"></div>
        </div>
        <div class="stat-value" style="font-size:24px">R$ ${(orc.disponivel/1000000).toFixed(1)}M</div>
        <div class="stat-label">Saldo Disponível</div>
      </div>
    </div>

    <!-- EXECUÇÃO ORÇAMENTÁRIA -->
    <div class="card" style="margin-bottom:24px">
      <div class="card-header">
        <div class="card-title">Execução orçamentária demonstrativa</div>
        <span style="font-size:12px;color:var(--text-muted)">Atualizado em ${new Date().toLocaleDateString('pt-BR')}</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:16px">
        ${[
          { label: 'Arrecadação', val: orc.arrecadado, total: orc.total, color: '#10b981', icon: '' },
          { label: 'Execução de Despesas', val: orc.executado, total: orc.total, color: '#f59e0b', icon: '' },
          { label: 'Saldo Disponível', val: orc.disponivel, total: orc.arrecadado, color: '#3b82f6', icon: '' }
        ].map(item => {
          const pct = Math.max(0, Math.min(100, item.total > 0 ? ((item.val / item.total) * 100) : 0)).toFixed(1);
          return `
            <div>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                <div style="display:flex;align-items:center;gap:8px">
                  <span style="font-size:14px;font-weight:500;color:var(--text-primary)">${item.label}</span>
                </div>
                <div style="text-align:right">
                  <span style="font-size:14px;font-weight:700;color:${item.color}">${formatCurrency(item.val)}</span>
                  <span style="font-size:12px;color:var(--text-muted);margin-left:8px">${pct}%</span>
                </div>
              </div>
              <div class="progress-bar" style="height:8px">
                <div class="progress-fill" style="width:${pct}%;background:${item.color}"></div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>

    <!-- RECEITAS E DESPESAS -->
    <div class="grid-2" style="margin-bottom:24px">
      <!-- RECEITAS -->
      <div class="card">
        <div class="card-header">
          <div class="card-title"> Fontes de Receita</div>
          <button class="btn btn-secondary btn-sm" onclick="verTodasReceitas()">Exportar CSV</button>
        </div>
        <div class="chart-container" style="margin-bottom:16px">
          <canvas id="chartReceitas" height="200"></canvas>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${DB.receitas.map(r => {
              const pct = r.previsto > 0 ? ((r.valor / r.previsto) * 100).toFixed(0) : null;
            return `
              <div style="display:flex;align-items:center;gap:12px">
                <div style="width:36px;height:36px;background:var(--bg-overlay);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:var(--primary-300);flex-shrink:0">${escapeHTML(r.tipo)}</div>
                <div style="flex:1">
                  <div style="display:flex;justify-content:space-between;margin-bottom:3px">
                    <span style="font-size:12px;color:var(--text-secondary)">${escapeHTML(r.descricao)}</span>
                    <span style="font-size:12px;font-weight:600;color:var(--text-primary)">${pct === null ? 'Sem previsão cadastrada' : `${pct}% do previsto`}</span>
                  </div>
                  <div class="progress-bar" style="height:4px">
                    <div class="progress-fill" style="width:${pct === null ? 0 : Math.min(100, Number(pct))}%"></div>
                  </div>
                </div>
                <div style="text-align:right;min-width:80px">
                  <div style="font-size:12px;font-weight:600;color:var(--accent-emerald-light)">${(r.valor/1000000).toFixed(1)}M</div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- DESPESAS POR SECRETARIA -->
      <div class="card">
        <div class="card-header">
          <div class="card-title"> Despesas por Secretaria</div>
          <button class="btn btn-secondary btn-sm" onclick="verTodasDespesas()">Exportar CSV</button>
        </div>
        <div class="chart-container" style="margin-bottom:16px">
          <canvas id="chartDespesas" height="200"></canvas>
        </div>
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>Secretaria</th>
                <th>Categoria</th>
                <th>Executado</th>
                <th>% Orçado</th>
              </tr>
            </thead>
            <tbody>
              ${DB.despesas.map(d => {
                const pct = d.orcado > 0 ? ((d.valor / d.orcado) * 100).toFixed(0) : null;
                return `
                  <tr>
                    <td style="font-size:12px">${escapeHTML(d.secretaria.replace('Secretaria de ','Sec. '))}</td>
                    <td style="font-size:12px">${escapeHTML(d.categoria)}</td>
                    <td style="color:var(--accent-gold-light);font-weight:600">${formatCurrency(d.valor)}</td>
                    <td>
                      <div style="display:flex;align-items:center;gap:8px">
                        <div class="progress-bar" style="width:60px;flex-shrink:0">
                          <div class="progress-fill" style="width:${pct === null ? 0 : Math.min(100, Number(pct))}%;background:${pct>80?'#f43f5e':pct>60?'#f59e0b':'#10b981'}"></div>
                        </div>
                        <span style="font-size:12px;color:var(--text-muted)">${pct === null ? 'Sem orçamento' : `${pct}%`}</span>
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- MODAL LANÇAMENTO -->
    <div class="modal-overlay" id="modal-lancamento">
      <div class="modal">
        <div class="modal-header">
          <h3 class="modal-title">Novo Lançamento Financeiro</h3>
          <button class="modal-close" onclick="fecharModal('modal-lancamento')">✕</button>
        </div>
        <form onsubmit="salvarLancamento(event)">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Tipo</label>
              <select class="form-control" id="lanc-tipo">
                <option value="receita">Receita</option>
                <option value="despesa">Despesa</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Valor (R$) *</label>
              <input type="number" class="form-control" id="lanc-valor" placeholder="0,00" step="0.01" min="0.01" required>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Descrição *</label>
            <input type="text" class="form-control" id="lanc-desc" placeholder="Descrição do lançamento" required>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Secretaria</label>
              <select class="form-control" id="lanc-sec">
                ${DB.secretarias.map(s=>`<option value="${escapeHTML(s.nome)}">${escapeHTML(s.nome)}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Data</label>
              <input type="date" class="form-control" id="lanc-data" value="${new Date().toISOString().slice(0,10)}">
            </div>
          </div>
          <div style="display:flex;gap:12px;justify-content:flex-end;margin-top:8px">
            <button type="button" class="btn btn-secondary" onclick="fecharModal('modal-lancamento')">Cancelar</button>
            <button type="submit" class="btn btn-primary">Salvar Lançamento</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function initFinanceiroCharts() {
  const ctxR = document.getElementById('chartReceitas');
  if (ctxR) {
    new Chart(ctxR, {
      type: 'pie',
      data: {
        labels: DB.receitas.map(r => r.tipo),
        datasets: [{ data: DB.receitas.map(r => r.valor), backgroundColor: ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#f43f5e','#06b6d4'], borderColor: '#0c1120', borderWidth: 2 }]
      },
      options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 11 } } } } }
    });
  }

  const ctxD = document.getElementById('chartDespesas');
  if (ctxD) {
    new Chart(ctxD, {
      type: 'bar',
      data: {
        labels: DB.despesas.map(d => d.secretaria.replace('Secretaria de ', 'Sec. ')),
        datasets: [
          { label: 'Executado', data: DB.despesas.map(d => d.valor / 1000000), backgroundColor: '#3b82f6', borderRadius: 4 },
          { label: 'Orçado', data: DB.despesas.map(d => d.orcado / 1000000), backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 4 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: true, indexAxis: 'y',
        plugins: { legend: { labels: { color: '#94a3b8', font: { size: 11 } } } },
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#475569', callback: v => `R$ ${v}M` } },
          y: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 10 } } }
        }
      }
    });
  }
}

function abrirLancamento() { document.getElementById('modal-lancamento').classList.add('active'); }

function salvarLancamento(e) {
  e.preventDefault();
  const tipo = document.getElementById('lanc-tipo').value;
  const valor = parseFloat(document.getElementById('lanc-valor').value);
  const descricao = document.getElementById('lanc-desc').value.trim();
  const secretaria = document.getElementById('lanc-sec').value;
  const data = document.getElementById('lanc-data').value;
  if (!Number.isFinite(valor) || valor <= 0 || !descricao) {
    showToast('Informe uma descrição e um valor maior que zero.', 'warning');
    return;
  }

  const saved = salvarAlteracaoComRollback(() => {
    if (tipo === 'receita') {
      DB.orcamento.arrecadado += valor;
      DB.receitas.push({
        id: generateId('REC', DB.receitas),
        tipo: 'Outros',
        descricao: `${descricao} — ${secretaria}`,
        valor,
        previsto: 0,
        mes: data
      });
    } else {
      DB.orcamento.executado += valor;
      DB.despesas.push({ id: generateId('DES', DB.despesas), data, secretaria, categoria: descricao, valor, orcado: 0 });
    }
    DB.orcamento.disponivel = DB.orcamento.arrecadado - DB.orcamento.executado;
  });
  if (!saved) return;
  fecharModal('modal-lancamento');
  showToast('Lançamento registrado.', 'success');
  navigate('financeiro');
}

function gerarRelatorioFin() {
  downloadCSV('relatorio_financeiro.csv', ['Grupo', 'Tipo/Secretaria', 'Descrição/Categoria', 'Valor', 'Previsto/Orçado'], [
    ['Orçamento', 'Total aprovado', '', DB.orcamento.total, ''],
    ['Orçamento', 'Arrecadado', '', DB.orcamento.arrecadado, ''],
    ['Orçamento', 'Executado', '', DB.orcamento.executado, ''],
    ...DB.receitas.map(r => ['Receita', r.tipo, r.descricao, r.valor, r.previsto]),
    ...DB.despesas.map(d => ['Despesa', d.secretaria, d.categoria, d.valor, d.orcado])
  ]);
}

function verTodasReceitas() {
  downloadCSV('receitas_municipais.csv', ['ID', 'Tipo', 'Descrição', 'Valor', 'Previsto', 'Período'],
    DB.receitas.map(r => [r.id, r.tipo, r.descricao, r.valor, r.previsto, r.mes]));
}

function verTodasDespesas() {
  downloadCSV('despesas_municipais.csv', ['ID', 'Data', 'Secretaria', 'Categoria', 'Valor', 'Orçado'],
    DB.despesas.map((d, index) => [d.id || `DES${String(index + 1).padStart(3, '0')}`, d.data || '', d.secretaria, d.categoria, d.valor, d.orcado]));
}
