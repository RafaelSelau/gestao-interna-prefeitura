# Matriz de verificação do SIGAM

Verificação executada em 20/10/2026. Os testes funcionais foram executados em Node.js com DOM simulado. Eles validam a lógica e a geração das telas, mas não substituem conferência visual em navegador real.

| Funcionalidade | Resultado esperado | Resultado obtido | Situação |
|---|---|---|---|
| Sintaxe JavaScript | Todos os módulos carregam sem erro | `node --check` aprovou os 8 módulos SIGAM e o novo `js/portal.js` | Aprovado |
| Recursos locais e CSS | CSS e scripts referenciados existem; chaves CSS balanceadas | 9 referências locais encontradas; 494 blocos CSS balanceados | Aprovado |
| Ações dos controles | Cada função chamada por handlers de clique, teclado, busca e formulário existe | Conferência estática encontrou 62 nomes de função declarados | Aprovado |
| Navegação | As telas disponíveis renderizam conteúdo | 10 chaves de rota renderizaram; incluem duas chaves para a tela de Ouvidoria | Aprovado |
| Módulos de demonstração | Cadastrar/excluir cidadão, serviço e obra; registrar lançamento financeiro | As quatro gravações e três exclusões foram exercitadas em DOM simulado | Aprovado |
| Criar tarefa | Salvar tarefa e histórico local | Tarefa de teste criada e evento inicial verificado | Aprovado |
| Concluir tarefa | Guardar status, data e evento de histórico | Status de conclusão e atualização registrados | Aprovado |
| Criar e encaminhar documento | Guardar registro, secretaria de destino e histórico | Documento criado e encaminhado; destino e segundo evento verificados | Aprovado |
| Filtros do painel | Abrir tarefas atrasadas e documentos no prazo; indicar filtro ativo | Filtros e rótulos de contexto renderizaram no DOM simulado | Aprovado |
| Categorias de serviços | Filtrar alvarás, certidões e licenças; limpar filtros | Alvará encontrou resultados; Licenças incluiu Habite-se; limpar filtros restaurou a lista | Aprovado |
| Alertas de prazos | Listar tarefas/documentos atrasados ou com prazo próximo, atualizar contagem e marcar como lidos | Contagem, painel de alertas e leitura verificados em DOM simulado | Aprovado |
| Busca global | Mostrar tarefas/documentos internos e abrir primeiro resultado com Enter | Resultados, exclusão dos documentos marcados como restritos e abertura foram verificados em DOM simulado; tecla Enter não foi acionada em navegador | Parcial |
| Detalhes de serviços e sessão | Abrir detalhes em janela integrada e mostrar informações honestas da sessão | Abertura das duas janelas confirmada em DOM simulado | Aprovado |
| Falha ao gravar localmente | Preservar o conteúdo anterior e não mostrar sucesso indevido | Simulação de falha no `localStorage` acionou rollback sem alterar a lista original | Aprovado |
| Anexo local | Rejeitar arquivo acima de 1 MB e tipo não aceito; abrir arquivo permitido | Regras existem no código; seleção/leitura de arquivo não foi testada em navegador | Pendente |
| Exportação CSV | Baixar CSV válido nos módulos | Geração e download pelo navegador não exercitados | Pendente |
| Responsividade e acessibilidade visual | Conferir layout, foco, teclado, contraste e controles em desktop/tablet/celular | CSS responsivo, foco visível e teclado nas categorias/cards revisados; sem inspeção visual real | Pendente de navegador |
| Servidor HTTP local | Página e API responderem no servidor integrado | Porta 8000 já serve a versão estática; servidor integrado iniciou em 8001; página respondeu 200 e `/api/health` respondeu `ok` | Aprovado em 8001 |
| Login, papéis e dados da API | Criar administrador local uma vez, autenticar e aplicar papéis | Assistente inicial local, SQLite, sessão CSRF/HttpOnly e autorização da API exercitados | Parcial — Fase 1 |
| Auditoria e backup institucional | Proteger trilha e recuperar dados | API grava trilha encadeada por hash; não é imutável contra administrador do banco; backup institucional ainda não implementado | Parcial |

## API SIGPM — verificação da Fase 1

| Funcionalidade | Procedimento | Resultado esperado | Resultado obtido | Situação |
|---|---|---|---|---|
| Inicialização e persistência SQLite | Criar administrador inicial e abrir DB temporário nos testes | Esquema criado e senha derivada, sem senha em texto | Inicialização e armazenamento verificados | Aprovado |
| Login e sessão | Login correto, cookie HttpOnly, consultar identidade; rota sem sessão | Sessão válida autenticada e rota anônima negada | Exercitado pela suíte `backend/tests/test_api.py` | Aprovado |
| CRUD da base | Criar secretaria, setor vinculado e pessoa; consultar busca | IDs persistidos e relacionamento válido | Exercitado pela suíte | Aprovado |
| Controle de função | Usar papel consulta e tentar escrita | Leitura permitida; escrita negada no servidor | Exercitado pela suíte | Aprovado |
| CSRF e duplicidade | Enviar escrita sem token correto e duplicar secretaria | Rejeitar escrita e responder conflito | 403 e 409 verificados | Aprovado |
| Auditoria | Consultar eventos após login e cadastro | Ações identificadas por ator/entidade e cadeia de hash | Eventos de cadastro verificados | Aprovado |
| Integração da interface antiga com a API | Usar telas de documentos/tarefas pelo backend | Dados compartilhados no servidor | Interface ainda grava em `localStorage` | Pendente |
| Teste HTTP do servidor integrado | Consultar página e `/api/health` em 127.0.0.1:8001 | Página SIGAM e API integradas respondem | HTTP 200 e `status: ok` verificados | Aprovado |

## Organização pessoal do funcionário — verificação em 21/10/2026

| Fluxo | Verificação | Resultado | Situação |
|---|---|---|---|
| Perfil profissional | Salvar e reler nome, e-mail, cargo, matrícula, telefone e horário | Persistência em SQLite; secretaria e setor vêm do vínculo autorizado | Aprovado pela API |
| Tarefas | Criar urgente com prazo, atualizar status, concluir e reabrir | Prioridade/status preservados, conclusão registrada e removida ao reabrir; histórico consultável | Aprovado pela API |
| Painel e atrasos | Consultar contadores por usuário e tarefa atrasada sem concluir automaticamente | Atrasada continua aberta; próxima ação considera prioridade e prazo | Aprovado pela API |
| Reuniões e ata | Agendar reunião, salvar ata, localizar em pesquisa e criar tarefa vinculada | Ata persistida e tarefa guarda a reunião de origem | Aprovado pela API |
| Documentos | Enviar arquivo, baixar autenticado e associar a evento | Arquivo fora da pasta pública; download do dono aprovado | Aprovado pela API |
| Isolamento entre funcionários | Segundo usuário tenta ler tarefa, evento, documento e baixar arquivo do primeiro | Respostas 404; listas pessoais vazias para a outra conta | Aprovado pela API |
| Notificações | Consultar aviso urgente e alterar preferências por tipo | Preferências individuais persistidas; avisos permanecem internos | Aprovado pela API |
| Planejamento e pesquisa | Persistência de prioridades/notas/objetivo semanal e busca por tipo | API de planejamento e pesquisa global implementadas; teste automatizado de busca encontrou ata | Parcial — faltam filtros combinados na pesquisa |
| Agenda mensal/semanal/diária/lista | Abrir vistas, navegar datas e conferir conflito | Interface e consulta de intervalos implementadas; navegação autenticada ainda não percorreu manualmente | Parcial |
| Upload, edição e arquivamento na interface | Enviar, renomear metadados, filtrar e arquivar | Rotas e formulários implementados; interação completa do navegador não testada nesta sessão | Parcial |
| Responsividade autenticada | Conferir tarefas, calendário, modais e formulários em celular | CSS mobile implementado; inspeção visual autenticada pendente | Pendente |
| Configuração do sistema compartilhado | Verificar estado de primeiro acesso do banco usado pela tela local | Administrador já existe; a base compartilhada está sem secretarias | Pendente: administrador deve cadastrar os nomes oficiais |

Os testes automatizados da API foram executados depois destas alterações: 10 testes aprovados. Não acessei nem alterei credenciais da base compartilhada; os fluxos autenticados foram conferidos numa base temporária.

## Ajustes de fluxo de demandas — 21/10/2026

| Fluxo | Verificação | Resultado | Situação |
|---|---|---|---|
| Configuração inicial | Criar administrador sem informar unidades | A API cria oito sugestões editáveis de secretarias para evitar o seletor vazio | Aprovado em teste automatizado |
| Secretarias personalizadas | Enviar nomes escolhidos pelo administrador, com espaços e duplicidades | Espaços removidos e nomes repetidos ignorados; unidades retornadas no portal público | Aprovado em teste automatizado |
| Nova demanda | Criar demanda autenticada com uma secretaria inicial | Protocolo gerado e vínculo à secretaria preservado | Aprovado em teste automatizado |
| Sem unidade cadastrada | Abrir o formulário em uma instalação existente sem secretarias | Formulário bloqueado com explicação; administrador recebe atalho para cadastro da unidade | Validado por inspeção do código; teste visual autenticado usa base temporária |
| Ações da demanda | Ajustar botões conforme status e perfil; validar campos obrigatórios antes do envio | Ações inválidas/incompatíveis ficam desabilitadas e exigências aparecem antes da chamada à API | Sintaxe aprovada; cobertura de API preservada |
| Formulário de usuário | Filtrar setores pela secretaria escolhida e exigir unidade em perfis não administradores | Opções de setor passam a corresponder à secretaria; servidor valida vínculo obrigatório | API e JavaScript aprovados |
| Aparência do portal | Refinar cartões, campos, botões, estados vazios e configuração inicial | CSS responsivo com foco visível, estados desabilitados claros e aviso de atendimento não configurado | Conferido no navegador |
| Fluxo visual autenticado | Criar demanda de teste, assumir, registrar providência, mudar status, encaminhar, solucionar, encerrar e reabrir | Cada ação atualizou a fila e o histórico; ações incompatíveis ficaram desabilitadas | Aprovado em base temporária |
| Recuperação sem unidades | Abrir Nova demanda sem secretaria, usar atalho, cadastrar unidade e retornar ao formulário | A tela explicou o bloqueio; após o cadastro, a unidade apareceu selecionada e o setor/conta foram liberados corretamente | Aprovado em base temporária |
| Formulário público | Registrar solicitação e acompanhar pelo botão “Acompanhar agora” | Protocolo e chave apareceram sem erro; acompanhamento retornou status e histórico | Aprovado em base temporária; corrigido reset do formulário após envio |

Suíte atual: 10 testes automatizados da API aprovados; sintaxe dos módulos JavaScript e Python aprovada. A base local compartilhada já possui administrador e ainda não possui secretarias; não foram inseridos nomes oficiais sem confirmação do administrador. O formulário agora explica o cadastro necessário e encaminha ao painel de unidades.

## Central de Demandas — verificação da primeira fatia

| Funcionalidade | Procedimento | Resultado esperado | Resultado obtido | Situação |
|---|---|---|---|---|
| Abertura e número de protocolo | Gestor autenticado cria demanda da sua secretaria | Persistência e número único gerado pelo servidor | Criação e formato `SIGAM-AAAA-NNNNNN` verificados | Aprovado |
| Escopo por secretaria | Gestor tenta abrir e consultar registros de outra unidade | API nega acesso direto | 403 verificado; após encaminhamento, a unidade anterior perde o acesso | Aprovado |
| Assumir, solucionar e encerrar | Gestor executa as ações válidas em sequência | Responsável, status, solução e data de fechamento atualizados | Fluxo completo exercitado pela suíte | Aprovado |
| Reabertura justificada | Gestor reabre demanda encerrada | Status volta para atendimento e justificativa entra no histórico | Fluxo exercitado; motivo obrigatório | Aprovado |
| Encaminhar entre secretarias | Gestor informa destino e justificativa | Unidade muda; histórico mantém origem/destino | Fluxo exercitado; escopo transferido | Aprovado |
| Histórico completo | Consultar eventos da demanda | Ações, ator, status e justificativa ordenados | Abertura e cinco movimentações verificadas | Aprovado |
| Tela do Portal Interno | Entrar, pesquisar, abrir e movimentar visualmente | Interface conectada à API | Arquivos implementados; verificação visual autenticada aguarda conta municipal inicial | Parcial |
| Assistente inicial | Abrir banco sem usuários; validar acesso local, cadastro inicial e bloqueio de segundo cadastro | Só loopback cria o primeiro administrador; configuração não pode ser repetida | Teste automatizado cobre 403 remoto, criação e 409 na repetição | Aprovado |
| Layout móvel do login | Inspecionar Portal em viewport estreito | Cartão cabe na tela sem rolagem horizontal | Conferido visualmente em 304 px; barra horizontal removida | Aprovado |
| Portal do cidadão | Abrir solicitação, gerar credencial, acompanhar com chave válida/inválida e responder pedido de informação | Solicitante vê só status e mensagens públicas do próprio protocolo | API exercitada; páginas e validação de chave implementadas | Parcial |
| Anexos privados e notificações externas | Anexar arquivo seguro e avisar cidadão por canal institucional | Arquivos privados e notificações autorizadas | Não implementados | Pendente |
