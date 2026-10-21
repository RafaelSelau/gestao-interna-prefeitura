# SIGAM / SIGPM — protótipo e API de gestão administrativa municipal

## Executar localmente

Python 3.10 ou superior não exige pacotes extras. Inicie o servidor integrado pela pasta do projeto:

```powershell
py backend/server.py --host 127.0.0.1 --port 8001
```

Abra `http://127.0.0.1:8001/portal.html`. Na primeira abertura, um assistente local cria o administrador municipal uma única vez e oferece uma lista editável de secretarias iniciais, para que o formulário de demandas já tenha destinos válidos. Confira os nomes oficiais antes de concluir. Instalações já configuradas sem secretarias podem criá-las em **Unidades e acessos**; ao tentar abrir uma demanda, o sistema mostra esse caminho em vez de deixar um campo vazio. Após o login, use **Minha rotina** ou abra `/produtividade.html` para acessar o organizador pessoal. Para acessar a interface SIGAM original, abra `/`. Se a porta estiver ocupada, escolha outra porta e use-a em ambos os endereços. Para encerrar, pressione **Ctrl+C**. O banco SQLite é criado em `backend/sigpm.sqlite3`; não publique esse arquivo.

Para a prévia antiga, isolada e sem API, ainda é possível usar `py -m http.server 8000 --bind 127.0.0.1`. Ela mantém os limites de demonstração descritos abaixo e não deve ser usada para acessar o Portal Interno.

Rotas principais: `GET/PUT /api/profile`, `GET /api/dashboard`, `GET/POST/PUT /api/tasks`, `GET/POST/PUT /api/events`, `GET/POST/PUT /api/documents`, `GET /api/search`, `GET/PUT /api/plan`, `GET /api/notifications` e `/preferences`; além das rotas de sessão, unidades, demandas e portal do cidadão descritas abaixo. Login retorna cookie de sessão HttpOnly e token CSRF. Operações internas de escrita exigem o token no cabeçalho `X-CSRF-Token`.

Para abrir a tela de trabalho da equipe, acesse `http://127.0.0.1:8001/portal.html` (ou use a porta configurada). O administrador precisa criar contas associadas a uma unidade para que gestores e atendentes vejam a fila da própria secretaria. A configuração inicial cria secretarias editáveis; instalações antigas podem cadastrar as unidades na tela **Unidades e acessos**.

Os testes da API rodam com `py -m unittest discover -s backend/tests -t . -v`.

## O que está implementado

- API local com persistência SQLite para usuários, secretarias, setores, pessoas/empresas e sessões.
- Senhas derivadas com scrypt; sessões aleatórias armazenadas como hash, expiração, cookie HttpOnly/SameSite e verificação CSRF.
- Papéis básicos (administrador, gestor, atendente e consulta), com autorização validada no backend.
- Registro de auditoria encadeado por hash para autenticações e alterações da API. O encadeamento torna alterações detectáveis, mas não é armazenamento imutável contra um administrador do arquivo/servidor.
- Testes automatizados da API para autenticação, permissões, CSRF, persistência, cadastros relacionados e auditoria.
- Portal Interno em `/portal.html`, conectado à API: demandas com protocolo sequencial, fila e pesquisa, atribuição a si, providências, status, encaminhamento, solução, encerramento e reabertura justificada.
- Escopo de demandas aplicado no backend por secretaria e, quando atribuído, setor. Administrador tem visão consolidada; gestor, atendente e consulta precisam de vínculo de unidade.
- Portal do cidadão em `/cidadao.html`: abertura, protocolo único, chave privada exibida uma única vez, acompanhamento pela chave e envio de informação complementar sem expor mensagens internas.
- Portal pessoal em `/produtividade.html`: perfil profissional, painel calculado para a conta autenticada, tarefas privadas (filtros por status/prioridade/período, lista/Kanban, histórico, prazo e conclusão), agenda mensal/semanal/diária/lista, reuniões e atas com tarefas vinculadas, planejamento pessoal, pesquisa global e notificações internas com preferências.
- Documentos pessoais persistidos no servidor: upload de até 8 MB, formatos limitados, metadados editáveis, etiquetas, associação com tarefas/reuniões, filtros por categoria/data, arquivamento e download autenticado restrito ao proprietário. Os arquivos ficam fora da pasta pública.
- Os registros de produtividade são privados por funcionário; cargo e setor no perfil não concedem permissões. A agenda usa horário local de Brasília e mostra sobreposições de eventos.

- Painel administrativo com contadores calculados dos registros internos criados.
- Indicadores do painel abrem listas filtradas; busca global abre o primeiro resultado com Enter.
- Alertas locais para tarefas e documentos vencidos ou com prazo nos próximos sete dias, com opção de marcar como lidos.
- Preferência para recolher o menu salva neste navegador e atalho de sessão que informa claramente que não existe login.
- Documentos: cadastro, metadados, anexo local limitado a 1 MB, pesquisa, filtros, exportação CSV, encaminhamento entre secretarias e histórico de movimentação.
- Tarefas: cadastro, edição, responsáveis, secretaria/setor, prazo, prioridade, vínculo opcional a documento, filtros, exportação, histórico de atualização, conclusão registrada, e visualizações em lista, quadro Kanban e calendário mensal.
- Detalhes de solicitações de serviço em janela integrada; filtros de categoria e botão para limpar filtros.
- Pesquisa global de documentos e tarefas. Registros marcados como “restritos” são omitidos dessa busca, mas o protótipo não aplica permissões de segurança.
- Módulos de demonstração já existentes: cidadãos, serviços municipais, ouvidoria de consulta, obras, secretarias de consulta e financeiro.
- As gravações locais dos módulos mantêm os dados anteriores se o navegador recusar a gravação. A interface usa tipografia do sistema e evita dependência de fontes externas.

## Limites importantes

Os módulos antigos da interface continuam usando `localStorage`; ainda não foram migrados para a API e não compartilham registros com o Portal Interno. A API é uma base de desenvolvimento local, não uma implantação segura de produção: faltam administração e revogação de sessões completas, limite de tentativas de login, HTTPS/proxy/segredos institucionais, backups testados, política de retenção, auditoria externa e avaliação de segurança. O escopo por unidade existe para demandas, mas ainda não está implementado em todos os módulos. O nível “restrito” da interface antiga é só informativo. **Não use documentos sigilosos nem dados pessoais reais.**

O serviço integrado serve a interface antiga, os portais autenticados e o portal do cidadão. As telas antigas ainda precisam trocar o `localStorage` pela API. A produtividade atual não permite compartilhamento de documentos entre funcionários nem foto de perfil; os arquivos são privados do proprietário. Notificações são internas, sem e-mail/SMS/push. O limitador de tentativas do portal público é em memória para desenvolvimento. O servidor local não substitui revisão de segurança, backups, HTTPS, governança de acesso e política institucional para implantação real.

## Plano incremental SIGPM

1. **Base (parcial):** API, sessão, papéis básicos, unidades, cadastro de pessoas e trilha de auditoria; faltam administração completa, revogação e gestão detalhada de permissões.
2. **Atendimento (parcial):** Central interna e portal inicial do cidadão com protocolo, acompanhamento pela chave e resposta a pedidos de informação; a agenda pessoal, tarefas e arquivos privados foram acrescentados; faltam compartilhamento de documentos, foto de perfil, integrações externas e migração dos módulos antigos.
3. **Tributos e alvarás:** somente após parametrização e validação das regras municipais.
4. **Administração:** RH, jurídico, junta militar, compras, almoxarifado e patrimônio, com áreas restritas próprias.
5. **Finanças e contratação:** licitações, contratos, contabilidade, orçamento e obras.
6. **Áreas finalísticas:** saúde, educação, assistência social, ouvidoria e transparência, condicionadas à governança de dados.
7. **Qualidade:** testes de segurança, desempenho e aceitação institucional para cada fase.

Os demais módulos contêm dados de exemplo, alguns com datas de 2024. Chart.js continua sendo carregado por CDN; sem conexão, a navegação básica funciona, mas gráficos podem mostrar um aviso de biblioteca indisponível. O comportamento visual em navegador real e a exportação/download de arquivos ainda precisam ser conferidos no navegador do usuário.
#   g e s t a o - i n t e r n a - p r e f e i t u r a  
 