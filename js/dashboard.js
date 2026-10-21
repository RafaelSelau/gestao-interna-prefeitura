// ===== MÓDULO DASHBOARD =====

function renderDashboard() {
  const stats = calcularEstatisticas();

  return `
    <div class="page-header">
      <div class="page-header-info">
        <h2>Dashboard Municipal</h2>
        <p>Visão geral do município • ${new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>
      <div class="page-header-actions">
        <button class="btn btn-secondary" onclick="exportarRelatorio()">Exportar resumo CSV</button>
        <button class="btn btn-primary" onclick="abrirNovoServico()">Nova solicitação</button>
      </div>
    </div>

    <!-- KPI CARDS -->
    <div class="grid-4" style="margin-bottom:24px">
      <div class="stat-card animate-countup">
        <div class="stat-card-header">
          <div class="stat-card-icon blue"></div>
        </div>
        <div class="stat-value" id="kpi-cidadaos">${stats.totalCidadaos}</div>
        <div class="stat-label">Cidadãos Cadastrados</div>
      </div>

      <div class="stat-card gold animate-countup">
        <div class="stat-card-header">
          <div class="stat-card-icon gold"></div>
        </div>
        <div class="stat-value" id="kpi-servicos">${stats.totalServicos}</div>
        <div class="stat-label">Serviços Solicitados</div>
      </div>

      <div class="stat-card emerald animate-countup">
        <div class="stat-card-header">
          <div class="stat-card-icon emerald"></div>
        </div>
        <div class="stat-value" id="kpi-obras">${stats.obrasAtivas}</div>
        <div class="stat-label">Obras em Andamento</div>
      </div>

      <div class="stat-card rose animate-countup">
        <div class="stat-card-header">
          <div class="stat-card-icon rose"></div>
          <span class="stat-change down">↓ 5%</span>
        </div>
        <div class="stat-value" id="kpi-protocolos">${stats.protocolosAbertos}</div>
        <div class="stat-label">Protocolos Pendentes</div>
      </div>
    </div>

    <!-- SECOND ROW STATS -->
    <div class="grid-4" style="margin-bottom:24px">
      <div class="stat-card">
        <div class="stat-card-header">
          <div class="stat-card-icon cyan"></div>
        </div>
        <div class="stat-value" style="font-size:22px">R$ ${(stats.orcamento.arrecadado / 1000000).toFixed(1)}M</div>
        <div class="stat-label">Arrecadação registrada</div>
      </div>

      <div class="stat-card">
        <div class="stat-card-header">
          <div class="stat-card-icon purple"></div>
        </div>
        <div class="stat-value">${stats.totalFuncionarios}</div>
        <div class="stat-label">Funcionários na base de demonstração</div>
      </div>

      <div class="stat-card">
        <div class="stat-card-header">
          <div class="stat-card-icon blue"></div>
        </div>
        <div class="stat-value">${stats.totalSecretarias}</div>
        <div class="stat-label">Secretarias Ativas</div>
      </div>

      <div class="stat-card">
        <div class="stat-card-header">
          <div class="stat-card-icon emerald"></div>
        </div>
        <div class="stat-value">${stats.servicosAprovados}</div>
        <div class="stat-label">Serviços Aprovados</div>
      </div>
    </div>

    <!-- CHARTS ROW -->
    <div class="grid-2-1" style="margin-bottom:24px">
      <!-- RECEITAS CHART -->
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">Arrecadação por fonte</div>
            <div class="card-subtitle">Valores registrados na base de demonstração</div>
          </div>
        </div>
        <div class="chart-container">
          <canvas id="chartArrecadacao" height="220"></canvas>
        </div>
      </div>

      <!-- ORÇAMENTO DONUT -->
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">Orçamento demonstrativo</div>
            <div class="card-subtitle">Execução orçamentária</div>
          </div>
        </div>
        <div class="chart-container" style="position:relative;height:200px;display:flex;align-items:center;justify-content:center">
          <canvas id="chartOrcamento"></canvas>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:16px">
          <div style="text-align:center;padding:12px;background:rgba(37,99,235,0.1);border-radius:10px;border:1px solid rgba(37,99,235,0.2)">
            <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">TOTAL</div>
            <div style="font-size:16px;font-weight:700;color:var(--primary-200)">${formatCurrency(DB.orcamento.total)}</div>
          </div>
          <div style="text-align:center;padding:12px;background:rgba(16,185,129,0.1);border-radius:10px;border:1px solid rgba(16,185,129,0.2)">
            <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">EXECUTADO</div>
            <div style="font-size:16px;font-weight:700;color:var(--accent-emerald-light)">${formatCurrency(DB.orcamento.executado)}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- BOTTOM ROW -->
    <div class="grid-2" style="margin-bottom:24px">
      <!-- ÚLTIMOS SERVIÇOS -->
      <div class="card">
        <div class="card-header">
          <div class="card-title"> Últimas Solicitações</div>
          <button class="btn btn-secondary btn-sm" onclick="navigate('servicos')">Ver Todos</button>
        </div>
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>Protocolo</th>
                <th>Tipo</th>
                <th>Status</th>
                <th>Data</th>
              </tr>
            </thead>
            <tbody>
              ${DB.servicos.slice(0, 5).map(s => `
                <tr>
                  <td><span style="font-family:monospace;font-size:12px;color:var(--primary-300)">${s.protocolo}</span></td>
                  <td>${s.tipo}</td>
                  <td>${getStatusBadge(s.status)}</td>
                  <td>${formatDate(s.data)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- OBRAS EM ANDAMENTO -->
      <div class="card">
        <div class="card-header">
          <div class="card-title"> Obras em Andamento</div>
          <button class="btn btn-secondary btn-sm" onclick="navigate('obras')">Ver Todas</button>
        </div>
        <div style="display:flex;flex-direction:column;gap:16px">
          ${DB.obras.filter(o => o.status === 'em_andamento').slice(0, 4).map(obra => `
            <div>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                <span style="font-size:13px;font-weight:500;color:var(--text-primary)">${obra.nome}</span>
                <span style="font-size:12px;color:var(--primary-300);font-weight:600">${obra.progresso}%</span>
              </div>
              <div class="progress-bar">
                <div class="progress-fill" style="width:${obra.progresso}%;background:${obra.progresso > 70 ? 'var(--gradient-emerald)' : obra.progresso > 40 ? 'var(--gradient-primary)' : 'var(--gradient-gold)'}"></div>
              </div>
              <div style="display:flex;justify-content:space-between;margin-top:4px">
                <span style="font-size:11px;color:var(--text-muted)">${obra.bairro}</span>
                <span style="font-size:11px;color:var(--text-muted)">Prev: ${formatDate(obra.fim_previsto)}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>

    <!-- OUVIDORIA + SECRETARIAS -->
    <div class="grid-2">
      <!-- OUVIDORIA RESUMO -->
      <div class="card">
        <div class="card-header">
          <div class="card-title"> Ouvidoria - Resumo</div>
          <button class="btn btn-secondary btn-sm" onclick="navigate('ouvidoria')">Ver Todos</button>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px">
          ${[
            { label: 'Abertos', val: DB.protocolos.filter(p=>p.status==='aberto').length, color: '#f59e0b' },
            { label: 'Em Andamento', val: DB.protocolos.filter(p=>p.status==='em_andamento').length, color: '#3b82f6' },
            { label: 'Resolvidos', val: DB.protocolos.filter(p=>['resolvido','encerrado'].includes(p.status)).length, color: '#10b981' }
          ].map(item => `
            <div style="text-align:center;padding:16px 12px;background:${item.color}14;border-radius:10px;border:1px solid ${item.color}33">
              <div style="font-size:24px;font-weight:700;color:${item.color}">${item.val}</div>
              <div style="font-size:11px;color:var(--text-muted);margin-top:4px">${item.label}</div>
            </div>
          `).join('')}
        </div>
        <div class="chart-container">
          <canvas id="chartOuvidoria" height="120"></canvas>
        </div>
      </div>

      <!-- SECRETARIAS DESTAQUE -->
      <div class="card">
        <div class="card-header">
          <div class="card-title"> Secretarias</div>
          <button class="btn btn-secondary btn-sm" onclick="navigate('secretarias')">Ver Todas</button>
        </div>
        <div style="display:flex;flex-direction:column;gap:10px">
          ${DB.secretarias.slice(0, 5).map(s => `
            <div style="display:flex;align-items:center;gap:12px;padding:10px;background:var(--bg-glass);border-radius:10px;border:1px solid var(--border-subtle);cursor:pointer;transition:all 0.2s" onmouseenter="this.style.background='var(--bg-glass-hover)'" onmouseleave="this.style.background='var(--bg-glass)'">
              <div style="width:36px;height:36px;background:var(--bg-overlay);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">${s.icon}</div>
              <div style="flex:1;min-width:0">
                <div style="font-size:13px;font-weight:500;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${s.nome}</div>
                <div style="font-size:11px;color:var(--text-muted)">${s.funcionarios} servidores</div>
              </div>
              <div style="text-align:right;flex-shrink:0">
                <div style="font-size:12px;font-weight:600;color:var(--primary-300)">${formatCurrency(s.orcamento)}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

function calcularEstatisticas() {
  return {
    totalCidadaos: DB.cidadaos.length,
    totalServicos: DB.servicos.length,
    obrasAtivas: DB.obras.filter(o => o.status === 'em_andamento').length,
    protocolosAbertos: DB.protocolos.filter(p => ['aberto', 'em_andamento', 'em_analise'].includes(p.status)).length,
    totalFuncionarios: DB.funcionarios.length,
    totalSecretarias: DB.secretarias.length,
    servicosAprovados: DB.servicos.filter(s => s.status === 'aprovado').length,
    orcamento: DB.orcamento
  };
}

function initDashboardCharts() {
  // Gráfico de arrecadação
  const ctxArr = document.getElementById('chartArrecadacao');
  if (!ctxArr) return;

  new Chart(ctxArr, {
    type: 'line',
    data: {
      labels: DB.receitas.map(receita => receita.tipo),
      datasets: [
        {
          label: 'Arrecadado (R$ milhões)',
          data: DB.receitas.map(receita => receita.valor / 1000000),
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59,130,246,0.1)',
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#3b82f6',
          pointRadius: 4,
          pointHoverRadius: 6
        },
        {
          label: 'Previsto (R$ milhões)',
          data: DB.receitas.map(receita => receita.previsto / 1000000),
          borderColor: '#f59e0b',
          borderDash: [5, 5],
          backgroundColor: 'transparent',
          tension: 0,
          pointRadius: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { labels: { color: '#94a3b8', font: { size: 12 } } },
        tooltip: { backgroundColor: '#1a2234', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1 }
      },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#475569' } },
        y: {
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: '#475569', callback: v => `R$ ${v}M` }
        }
      }
    }
  });

  // Gráfico de orçamento donut
  const ctxOrc = document.getElementById('chartOrcamento');
  if (ctxOrc) {
    new Chart(ctxOrc, {
      type: 'doughnut',
      data: {
        labels: ['Executado', 'Disponível', 'A Arrecadar'],
        datasets: [{
          data: [
            DB.orcamento.executado / 1000000,
            DB.orcamento.disponivel / 1000000,
            Math.max(DB.orcamento.total - DB.orcamento.arrecadado, 0) / 1000000
          ],
          backgroundColor: ['#10b981', '#3b82f6', '#1a2234'],
          borderColor: ['#065f46', '#1e3a7a', '#0c1120'],
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: { display: true, position: 'bottom', labels: { color: '#94a3b8', boxWidth: 10, padding: 12 } },
          tooltip: { backgroundColor: '#1a2234', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1, callbacks: { label: ctx => ` R$ ${ctx.parsed}M` } }
        }
      }
    });
  }

  // Gráfico ouvidoria
  const ctxOuv = document.getElementById('chartOuvidoria');
  if (ctxOuv) {
    const tipos = {};
    DB.protocolos.forEach(p => { tipos[p.tipo] = (tipos[p.tipo] || 0) + 1; });
    new Chart(ctxOuv, {
      type: 'bar',
      data: {
        labels: Object.keys(tipos),
        datasets: [{
          data: Object.values(tipos),
          backgroundColor: ['#3b82f6','#f59e0b','#f43f5e','#10b981','#8b5cf6'],
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#475569', font: { size: 11 } } },
          y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#475569', stepSize: 1 } }
        }
      }
    });
  }
}

function exportarRelatorio() {
  const resumo = calcularEstatisticas();
  downloadCSV(`resumo_municipal_${new Date().toISOString().slice(0, 10)}.csv`, ['Indicador', 'Quantidade/valor'], [
    ['Cidadãos cadastrados', resumo.totalCidadaos],
    ['Serviços municipais', resumo.totalServicos],
    ['Obras em andamento', resumo.obrasAtivas],
    ['Protocolos abertos ou em andamento', resumo.protocolosAbertos],
    ['Funcionários na base demonstrativa', resumo.totalFuncionarios],
    ['Secretarias cadastradas', resumo.totalSecretarias],
    ['Serviços aprovados', resumo.servicosAprovados],
    ['Orçamento total', resumo.orcamento.total],
    ['Arrecadado', resumo.orcamento.arrecadado],
    ['Executado', resumo.orcamento.executado]
  ]);
}
