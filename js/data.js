// ===== DATA SIMULADA DO SISTEMA DE PREFEITURA =====

const DB = {
  // === CIDADÃOS ===
  cidadaos: [
    { id: 'CID001', nome: 'Carlos Eduardo Mendes', cpf: '123.456.789-01', rg: '12.345.678-9', nascimento: '1985-03-15', email: 'carlos.mendes@email.com', telefone: '(11) 98765-4321', endereco: 'Rua das Flores, 123', bairro: 'Centro', cep: '01310-100', status: 'ativo', cadastro: '2023-01-15' },
    { id: 'CID002', nome: 'Maria Aparecida Santos', cpf: '234.567.890-12', rg: '23.456.789-0', nascimento: '1972-07-22', email: 'maria.santos@email.com', telefone: '(11) 91234-5678', endereco: 'Av. Brasil, 456', bairro: 'Jardim América', cep: '01430-001', status: 'ativo', cadastro: '2023-02-20' },
    { id: 'CID003', nome: 'João Paulo Ferreira', cpf: '345.678.901-23', rg: '34.567.890-1', nascimento: '1990-11-08', email: 'joao.ferreira@email.com', telefone: '(11) 99876-5432', endereco: 'Rua Paraíba, 789', bairro: 'Liberdade', cep: '01321-000', status: 'ativo', cadastro: '2023-03-10' },
    { id: 'CID004', nome: 'Ana Lucia Rodrigues', cpf: '456.789.012-34', rg: '45.678.901-2', nascimento: '1968-05-30', email: 'ana.rodrigues@email.com', telefone: '(11) 95432-1098', endereco: 'Travessa da Paz, 12', bairro: 'Moema', cep: '04077-020', status: 'inativo', cadastro: '2023-04-05' },
    { id: 'CID005', nome: 'Roberto Carlos Lima', cpf: '567.890.123-45', rg: '56.789.012-3', nascimento: '1955-12-03', email: 'roberto.lima@email.com', telefone: '(11) 97654-3210', endereco: 'Praça da Sé, 1', bairro: 'Sé', cep: '01001-001', status: 'ativo', cadastro: '2023-04-18' },
    { id: 'CID006', nome: 'Fernanda Oliveira Costa', cpf: '678.901.234-56', rg: '67.890.123-4', nascimento: '1995-08-14', email: 'fernanda.costa@email.com', telefone: '(11) 98877-6655', endereco: 'Rua Augusta, 500', bairro: 'Consolação', cep: '01304-001', status: 'ativo', cadastro: '2023-05-12' },
    { id: 'CID007', nome: 'Paulo Henrique Souza', cpf: '789.012.345-67', rg: '78.901.234-5', nascimento: '1980-01-25', email: 'paulo.souza@email.com', telefone: '(11) 94433-2211', endereco: 'Av. Paulista, 1000', bairro: 'Bela Vista', cep: '01310-100', status: 'ativo', cadastro: '2023-06-08' },
    { id: 'CID008', nome: 'Luciana Beatriz Alves', cpf: '890.123.456-78', rg: '89.012.345-6', nascimento: '1987-09-19', email: 'luciana.alves@email.com', telefone: '(11) 93322-1100', endereco: 'Rua Oscar Freire, 200', bairro: 'Jardins', cep: '01426-001', status: 'pendente', cadastro: '2023-07-22' }
  ],

  // === SERVIÇOS ===
  servicos: [
    { id: 'SRV001', cidadao: 'Carlos Eduardo Mendes', tipo: 'Alvará de Funcionamento', protocolo: 'PREF-2024-001234', status: 'aprovado', data: '2024-01-10', prazo: '2024-01-20', responsavel: 'Sec. Planejamento', valor: 250.00, descricao: 'Alvará para estabelecimento comercial' },
    { id: 'SRV002', cidadao: 'Maria Aparecida Santos', tipo: 'Certidão de IPTU', protocolo: 'PREF-2024-001235', status: 'em_andamento', data: '2024-01-12', prazo: '2024-01-17', responsavel: 'Sec. Fazenda', valor: 0, descricao: 'Certidão negativa de débito IPTU' },
    { id: 'SRV003', cidadao: 'João Paulo Ferreira', tipo: 'Licença de Obra', protocolo: 'PREF-2024-001236', status: 'pendente', data: '2024-01-14', prazo: '2024-02-14', responsavel: 'Sec. Obras', valor: 1200.00, descricao: 'Licença para reforma residencial' },
    { id: 'SRV004', cidadao: 'Ana Lucia Rodrigues', tipo: 'Parcelamento de Débito', protocolo: 'PREF-2024-001237', status: 'aprovado', data: '2024-01-08', prazo: '2024-01-13', responsavel: 'Sec. Fazenda', valor: 3500.00, descricao: 'Parcelamento de débito em 12x' },
    { id: 'SRV005', cidadao: 'Roberto Carlos Lima', tipo: 'Alvará de Reformas', protocolo: 'PREF-2024-001238', status: 'recusado', data: '2024-01-09', prazo: '2024-02-09', responsavel: 'Sec. Urbanismo', valor: 480.00, descricao: 'Documentação incompleta' },
    { id: 'SRV006', cidadao: 'Fernanda Oliveira Costa', tipo: 'Certidão Histórica', protocolo: 'PREF-2024-001239', status: 'em_andamento', data: '2024-01-15', prazo: '2024-01-25', responsavel: 'Arquivo Geral', valor: 50.00, descricao: 'Certidão de histórico do imóvel' },
    { id: 'SRV007', cidadao: 'Paulo Henrique Souza', tipo: 'Habite-se', protocolo: 'PREF-2024-001240', status: 'aprovado', data: '2024-01-05', prazo: '2024-02-05', responsavel: 'Sec. Obras', valor: 800.00, descricao: 'Habite-se para nova construção' },
    { id: 'SRV008', cidadao: 'Luciana Beatriz Alves', tipo: 'Cadastro Imobiliário', protocolo: 'PREF-2024-001241', status: 'pendente', data: '2024-01-16', prazo: '2024-01-26', responsavel: 'Sec. Fazenda', valor: 0, descricao: 'Atualização de cadastro imobiliário' }
  ],

  // === FUNCIONÁRIOS ===
  funcionarios: [
    { id: 'FUN001', nome: 'Dr. Antonio Marques Silva', cargo: 'Prefeito', secretaria: 'Gabinete', salario: 18000.00, admissao: '2021-01-01', status: 'ativo', cpf: '111.222.333-44', matricula: 'MAT-0001', telefone: '(11) 3000-0001', email: 'prefeito@prefeitura.gov.br', escolaridade: 'Doutorado' },
    { id: 'FUN002', nome: 'Dra. Marcia Fernandes', cargo: 'Secretária de Saúde', secretaria: 'Secretaria de Saúde', salario: 12000.00, admissao: '2021-02-01', status: 'ativo', cpf: '222.333.444-55', matricula: 'MAT-0002', telefone: '(11) 3000-0002', email: 'saude@prefeitura.gov.br', escolaridade: 'Mestrado' },
    { id: 'FUN003', nome: 'Eng. Ricardo Torres', cargo: 'Secretário de Obras', secretaria: 'Secretaria de Obras', salario: 11500.00, admissao: '2021-02-01', status: 'ativo', cpf: '333.444.555-66', matricula: 'MAT-0003', telefone: '(11) 3000-0003', email: 'obras@prefeitura.gov.br', escolaridade: 'Graduação' },
    { id: 'FUN004', nome: 'Ana Paula Vieira', cargo: 'Secretária de Educação', secretaria: 'Secretaria de Educação', salario: 11000.00, admissao: '2021-02-15', status: 'ativo', cpf: '444.555.666-77', matricula: 'MAT-0004', telefone: '(11) 3000-0004', email: 'educacao@prefeitura.gov.br', escolaridade: 'Mestrado' },
    { id: 'FUN005', nome: 'Carlos Moura', cargo: 'Analista Administrativo', secretaria: 'Secretaria de Finanças', salario: 5800.00, admissao: '2019-06-10', status: 'ativo', cpf: '555.666.777-88', matricula: 'MAT-0125', telefone: '(11) 3000-0125', email: 'carlos.moura@prefeitura.gov.br', escolaridade: 'Graduação' },
    { id: 'FUN006', nome: 'Sandra Gomes', cargo: 'Assistente Social', secretaria: 'Secretaria de Assistência Social', salario: 4200.00, admissao: '2018-03-20', status: 'ativo', cpf: '666.777.888-99', matricula: 'MAT-0256', telefone: '(11) 3000-0256', email: 'sandra.gomes@prefeitura.gov.br', escolaridade: 'Graduação' },
    { id: 'FUN007', nome: 'Marcos Pereira', cargo: 'Fiscal de Posturas', secretaria: 'Secretaria de Planejamento', salario: 4800.00, admissao: '2020-08-15', status: 'ativo', cpf: '777.888.999-00', matricula: 'MAT-0312', telefone: '(11) 3000-0312', email: 'marcos.pereira@prefeitura.gov.br', escolaridade: 'Técnico' },
    { id: 'FUN008', nome: 'Juliana Castro', cargo: 'Auxiliar Administrativo', secretaria: 'Secretaria de Administração', salario: 3200.00, admissao: '2022-01-05', status: 'afastado', cpf: '888.999.000-11', matricula: 'MAT-0487', telefone: '(11) 3000-0487', email: 'juliana.castro@prefeitura.gov.br', escolaridade: 'Médio' }
  ],

  // === OBRAS ===
  obras: [
    { id: 'OBR001', nome: 'Pavimentação Av. Central', tipo: 'Infraestrutura Viária', secretaria: 'Sec. Obras', status: 'em_andamento', progresso: 68, investimento: 2850000, inicio: '2023-09-01', fim_previsto: '2024-03-31', contratada: 'Construtora Brasil Ltda', bairro: 'Centro', responsavel: 'Eng. Ricardo Torres', descricao: 'Pavimentação asfáltica de 3,2km da via principal' },
    { id: 'OBR002', nome: 'Reforma UBS Jardim das Flores', tipo: 'Saúde', secretaria: 'Sec. Saúde', status: 'concluida', progresso: 100, investimento: 850000, inicio: '2023-06-01', fim_previsto: '2023-12-31', contratada: 'Engenharia Sul SA', bairro: 'Jardim das Flores', responsavel: 'Dra. Marcia Fernandes', descricao: 'Reforma completa e ampliação da UBS' },
    { id: 'OBR003', nome: 'Construção Escola Municipal', tipo: 'Educação', secretaria: 'Sec. Educação', status: 'em_andamento', progresso: 35, investimento: 4200000, inicio: '2023-11-01', fim_previsto: '2024-08-31', contratada: 'Educons Engenharia', bairro: 'Vila Nova', responsavel: 'Ana Paula Vieira', descricao: 'Escola com 20 salas, laboratórios e ginásio' },
    { id: 'OBR004', nome: 'Praça Municipal Nova', tipo: 'Lazer e Esporte', secretaria: 'Sec. Obras', status: 'planejado', progresso: 0, investimento: 620000, inicio: '2024-03-01', fim_previsto: '2024-07-31', contratada: 'Verde Urbanismo', bairro: 'Boa Vista', responsavel: 'Eng. Ricardo Torres', descricao: 'Praça com academia ao ar livre e pista de skate' },
    { id: 'OBR005', nome: 'Revitalização Mercado Municipal', tipo: 'Cultura e Comércio', secretaria: 'Sec. Cultura', status: 'em_andamento', progresso: 52, investimento: 1350000, inicio: '2023-10-15', fim_previsto: '2024-04-15', contratada: 'Patrimônio Vivo Ltda', bairro: 'Centro Histórico', responsavel: 'Sec. Cultura', descricao: 'Revitalização do mercado histórico com preservação do patrimônio' },
    { id: 'OBR006', nome: 'Sistema de Drenagem Setor Leste', tipo: 'Saneamento', secretaria: 'Sec. Obras', status: 'licitacao', progresso: 0, investimento: 3100000, inicio: '2024-04-01', fim_previsto: '2025-04-01', contratada: 'Em Licitação', bairro: 'Setor Leste', responsavel: 'Eng. Ricardo Torres', descricao: 'Implantação de rede de micro e macrodrenagem' }
  ],

  // === FINANÇAS ===
  orcamento: {
    total: 180000000,
    arrecadado: 94500000,
    executado: 72300000,
    disponivel: 22200000
  },

  receitas: [
    { id: 'REC001', tipo: 'IPTU', descricao: 'Imposto Predial e Territorial Urbano', valor: 28500000, previsto: 35000000, mes: 'Jan-Jun 2024' },
    { id: 'REC002', tipo: 'ISS', descricao: 'Imposto Sobre Serviços', valor: 18200000, previsto: 22000000, mes: 'Jan-Jun 2024' },
    { id: 'REC003', tipo: 'FPM', descricao: 'Fundo de Participação dos Municípios', valor: 31000000, previsto: 62000000, mes: 'Jan-Jun 2024' },
    { id: 'REC004', tipo: 'ITBI', descricao: 'Imposto de Transmissão de Bens Imóveis', valor: 8900000, previsto: 12000000, mes: 'Jan-Jun 2024' },
    { id: 'REC005', tipo: 'TAXAS', descricao: 'Taxas Diversas', valor: 4200000, previsto: 6000000, mes: 'Jan-Jun 2024' },
    { id: 'REC006', tipo: 'CONVÊNIOS', descricao: 'Transferências e Convênios', valor: 3700000, previsto: 5000000, mes: 'Jan-Jun 2024' }
  ],

  despesas: [
    { id: 'DES001', secretaria: 'Secretaria de Saúde', categoria: 'Pessoal', valor: 18500000, orcado: 22000000 },
    { id: 'DES002', secretaria: 'Secretaria de Educação', categoria: 'Pessoal', valor: 16800000, orcado: 20000000 },
    { id: 'DES003', secretaria: 'Secretaria de Obras', categoria: 'Obras e Investimentos', valor: 12300000, orcado: 30000000 },
    { id: 'DES004', secretaria: 'Secretaria de Assistência Social', categoria: 'Benefícios', valor: 7200000, orcado: 9000000 },
    { id: 'DES005', secretaria: 'Secretaria de Administração', categoria: 'Custeio', valor: 5100000, orcado: 7000000 },
    { id: 'DES006', secretaria: 'Secretaria de Finanças', categoria: 'Custeio', valor: 3200000, orcado: 4500000 }
  ],

  // === OUVIDORIA ===
  protocolos: [
    { id: 'OUV001', protocolo: 'OUV-2024-0001', cidadao: 'Carlos Eduardo Mendes', tipo: 'Reclamação', assunto: 'Buraco na rua Av. Central próximo ao nº 200', secretaria: 'Sec. Obras', status: 'resolvido', prioridade: 'alta', data: '2024-01-02', prazo: '2024-01-17', resposta: 'Reparo realizado em 15/01/2024' },
    { id: 'OUV002', protocolo: 'OUV-2024-0002', cidadao: 'Maria Aparecida Santos', tipo: 'Sugestão', assunto: 'Criação de ciclovia na Av. das Palmeiras', secretaria: 'Sec. Planejamento', status: 'em_analise', prioridade: 'media', data: '2024-01-05', prazo: '2024-02-05', resposta: '' },
    { id: 'OUV003', protocolo: 'OUV-2024-0003', cidadao: 'João Paulo Ferreira', tipo: 'Denúncia', assunto: 'Descarte irregular de lixo no Parque Linear', secretaria: 'Sec. Meio Ambiente', status: 'em_andamento', prioridade: 'alta', data: '2024-01-07', prazo: '2024-01-22', resposta: 'Equipe de fiscalização notificada' },
    { id: 'OUV004', protocolo: 'OUV-2024-0004', cidadao: 'Ana Lucia Rodrigues', tipo: 'Elogio', assunto: 'Excelente atendimento na UBS Central', secretaria: 'Sec. Saúde', status: 'encerrado', prioridade: 'baixa', data: '2024-01-08', prazo: '2024-02-08', resposta: 'Elogio encaminhado à equipe' },
    { id: 'OUV005', protocolo: 'OUV-2024-0005', cidadao: 'Roberto Carlos Lima', tipo: 'Reclamação', assunto: 'Falta de iluminação pública na Rua das Orquídeas', secretaria: 'Sec. Obras', status: 'aberto', prioridade: 'media', data: '2024-01-10', prazo: '2024-01-25', resposta: '' },
    { id: 'OUV006', protocolo: 'OUV-2024-0006', cidadao: 'Fernanda Oliveira Costa', tipo: 'Informação', assunto: 'Como solicitar isenção de IPTU para idosos', secretaria: 'Sec. Fazenda', status: 'resolvido', prioridade: 'baixa', data: '2024-01-11', prazo: '2024-01-16', resposta: 'Informação fornecida com sucesso' },
    { id: 'OUV007', protocolo: 'OUV-2024-0007', cidadao: 'Paulo Henrique Souza', tipo: 'Reclamação', assunto: 'Obras inacabadas há 3 meses na Rua São João', secretaria: 'Sec. Obras', status: 'em_andamento', prioridade: 'alta', data: '2024-01-13', prazo: '2024-01-28', resposta: 'Prazo de conclusão verificado com contratada' }
  ],

  // === SECRETARIAS ===
  secretarias: [
    { id: 'SEC001', nome: 'Gabinete do Prefeito', secretario: 'Dr. Antonio Marques Silva', funcionarios: 12, orcamento: 3500000, telefone: '(11) 3000-0001', email: 'gabinete@prefeitura.gov.br', endereco: 'Praça da Prefeitura, 1', icon: '', cor: 'blue' },
    { id: 'SEC002', nome: 'Secretaria de Saúde', secretario: 'Dra. Marcia Fernandes', funcionarios: 486, orcamento: 22000000, telefone: '(11) 3000-1000', email: 'saude@prefeitura.gov.br', endereco: 'Av. da Saúde, 100', icon: '', cor: 'emerald' },
    { id: 'SEC003', nome: 'Secretaria de Educação', secretario: 'Ana Paula Vieira', funcionarios: 1240, orcamento: 20000000, telefone: '(11) 3000-2000', email: 'educacao@prefeitura.gov.br', endereco: 'Rua do Ensino, 200', icon: '', cor: 'gold' },
    { id: 'SEC004', nome: 'Secretaria de Obras', secretario: 'Eng. Ricardo Torres', funcionarios: 320, orcamento: 30000000, telefone: '(11) 3000-3000', email: 'obras@prefeitura.gov.br', endereco: 'Av. da Infraestrutura, 300', icon: '', cor: 'orange' },
    { id: 'SEC005', nome: 'Secretaria de Finanças', secretario: 'José Roberto Costa', funcionarios: 85, orcamento: 4500000, telefone: '(11) 3000-4000', email: 'financas@prefeitura.gov.br', endereco: 'Rua da Fazenda, 400', icon: '', cor: 'purple' },
    { id: 'SEC006', nome: 'Secretaria de Assistência Social', secretario: 'Sandra Gomes', funcionarios: 156, orcamento: 9000000, telefone: '(11) 3000-5000', email: 'social@prefeitura.gov.br', endereco: 'Av. Solidariedade, 500', icon: '', cor: 'rose' },
    { id: 'SEC007', nome: 'Secretaria de Meio Ambiente', secretario: 'Lucia Verde', funcionarios: 78, orcamento: 5500000, telefone: '(11) 3000-6000', email: 'ambiente@prefeitura.gov.br', endereco: 'Parque Municipal, s/n', icon: '', cor: 'emerald' },
    { id: 'SEC008', nome: 'Secretaria de Cultura e Turismo', secretario: 'Pedro Artes', funcionarios: 62, orcamento: 3800000, telefone: '(11) 3000-7000', email: 'cultura@prefeitura.gov.br', endereco: 'Teatro Municipal, Praça Central', icon: '', cor: 'purple' }
  ],

  // === NOTIFICAÇÕES ===
  notificacoes: [
    { id: 1, icon: '', titulo: 'Novo protocolo de serviço', tempo: 'Há 5 min', tipo: 'info', lido: false },
    { id: 2, icon: '', titulo: 'Prazo de obra vencendo amanhã', tempo: 'Há 1 hora', tipo: 'warning', lido: false },
    { id: 3, icon: '', titulo: 'Alvará aprovado - Protocolo 001234', tempo: 'Há 2 horas', tipo: 'success', lido: true },
    { id: 4, icon: '', titulo: 'Pagamento de IPTU confirmado', tempo: 'Há 3 horas', tipo: 'success', lido: true },
    { id: 5, icon: '', titulo: 'Denúncia de alta prioridade', tempo: 'Há 4 horas', tipo: 'danger', lido: false }
  ],

  // Módulos internos do SIGAM. Iniciam vazios; os registros são criados pelo usuário.
  documentosInternos: [],
  tarefasInternas: []
};

// === HELPER FUNCTIONS ===
function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr))) return '-';
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

function formatCPF(cpf) { return cpf; }

function getStatusBadge(status) {
  const map = {
    aprovado: '<span class="badge badge-success">Aprovado</span>',
    em_andamento: '<span class="badge badge-info">Em Andamento</span>',
    pendente: '<span class="badge badge-warning">Pendente</span>',
    recusado: '<span class="badge badge-danger">Recusado</span>',
    concluida: '<span class="badge badge-success">Concluída</span>',
    planejado: '<span class="badge badge-default">Planejado</span>',
    licitacao: '<span class="badge badge-purple">Licitação</span>',
    ativo: '<span class="badge badge-success">● Ativo</span>',
    inativo: '<span class="badge badge-default">● Inativo</span>',
    afastado: '<span class="badge badge-warning">● Afastado</span>',
    pendente_cidadao: '<span class="badge badge-warning">Pendente</span>',
    resolvido: '<span class="badge badge-success">Resolvido</span>',
    em_analise: '<span class="badge badge-info">Em Análise</span>',
    aberto: '<span class="badge badge-warning">Aberto</span>',
    encerrado: '<span class="badge badge-default">Encerrado</span>',
    pendente_status: '<span class="badge badge-warning">Pendente</span>'
  };
  return map[status] || `<span class="badge badge-default">${escapeHTML(status || 'Sem status')}</span>`;
}

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function getPrioridadeBadge(p) {
  const map = {
    alta: '<span class="badge badge-danger">Alta</span>',
    media: '<span class="badge badge-warning">Média</span>',
    baixa: '<span class="badge badge-success">Baixa</span>'
  };
  return map[p] || p;
}

function generateId(prefix, records = []) {
  const next = records.reduce((largest, item) => {
    const match = String(item.id || '').match(/(\d+)$/);
    return Math.max(largest, match ? Number(match[1]) : 0);
  }, 0) + 1;
  return `${prefix}${String(next).padStart(3, '0')}`;
}

function saveToStorage() {
  try {
    localStorage.setItem('prefeitura_db', JSON.stringify(DB));
    return true;
  } catch (error) {
    console.error('Não foi possível salvar os dados neste navegador.', error);
    if (typeof showToast === 'function') showToast('Alteração feita nesta sessão, mas não foi possível salvá-la no navegador.', 'error');
    return false;
  }
}

function salvarAlteracaoComRollback(update) {
  let snapshot;
  try {
    snapshot = JSON.stringify(DB);
    update();
    if (saveToStorage()) return true;
  } catch (error) {
    console.error('A alteração não pôde ser aplicada.', error);
    if (typeof showToast === 'function') showToast('Não foi possível aplicar a alteração. Os dados anteriores foram preservados.', 'error');
  }
  if (snapshot) {
    const previous = JSON.parse(snapshot);
    Object.keys(DB).forEach(key => delete DB[key]);
    Object.assign(DB, previous);
  }
  return false;
}

function loadFromStorage() {
  try {
    const saved = localStorage.getItem('prefeitura_db');
    if (saved) {
      const data = JSON.parse(saved);
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Formato de dados inválido.');
      Object.assign(DB, data);
    }
  } catch (error) {
    console.error('Os dados salvos não puderam ser carregados. A demonstração usará os dados iniciais.', error);
  }
}

// Carrega dados do storage ao iniciar
loadFromStorage();
if (!Array.isArray(DB.documentosInternos)) DB.documentosInternos = [];
if (!Array.isArray(DB.tarefasInternas)) DB.tarefasInternas = [];
