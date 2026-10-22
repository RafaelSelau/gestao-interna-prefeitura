# SIGPM — Sistema de Gestão e Produtividade Municipal

## Executar localmente

Python 3.10 ou superior não exige pacotes extras. Inicie o servidor integrado pela pasta do projeto:

```powershell
py backend/server.py --host 127.0.0.1 --port 8001
```

Abra `http://127.0.0.1:8001/` para a tela institucional do SIGPM e selecione **Entrar no sistema**. O login (ou a configuração inicial local, se ainda não houver administrador) fica em `/portal.html`. Após autenticar, o sistema abre o dashboard em `/produtividade.html`. O menu principal contém apenas **Dashboard**, **Tarefas**, **Documentos**, **Secretarias** e **Sair da conta**. `/index.html` redireciona para a aplicação autenticada e exige sessão. Se a porta estiver ocupada, escolha outra porta e use-a nos endereços. Para encerrar, pressione **Ctrl+C**. O banco SQLite é criado em `backend/sigpm.sqlite3`; não publique esse arquivo.

Se uma instância antiga do servidor já estiver usando a porta `8001`, pare-a com **Ctrl+C** no terminal dela e execute novamente o comando acima. O painel verifica a versão da API e mostra essa orientação se as rotas atuais de tarefas, dashboard e secretarias não estiverem disponíveis.

As páginas internas exigem uma sessão válida no servidor integrado. O sistema não usa `localStorage` para tarefas, documentos ou dados de dashboard.

Rotas principais do painel: `GET /api/dashboard`, CRUD de `/api/tasks`, `/api/documents` e `/api/departments`. Login retorna cookie de sessão HttpOnly e token CSRF. Operações internas de escrita exigem o token no cabeçalho `X-CSRF-Token`. Outras rotas e tabelas antigas permanecem no backend para compatibilidade e preservação dos registros existentes.

O administrador inicial é criado pelo formulário local de `/portal.html` ou pelo comando `--create-admin`. A tela de Secretarias permite cadastro, edição e exclusão para administradores. Uma secretaria só pode ser excluída se não tiver vínculos com setores, usuários, demandas, tarefas ou documentos.

Os testes da API rodam com `py -m unittest discover -s backend/tests -t . -v`.

### Preparar ambiente para apresentação

A conta de demonstração é autenticada pelo backend e deve ficar em uma base SQLite isolada. Configure `SIGPM_DEMO_EMAIL` com o e-mail autorizado para a demonstração e prepare uma base nova:

```powershell
$env:SIGPM_DEMO_EMAIL = "seu-email-autorizado@municipio.gov.br"
py backend/server.py --create-demo --demo-db backend/sigpm-demo-apresentacao.sqlite3
```

Use o e-mail autorizado como nome de usuário. O comando pede senhas de pelo menos 12 caracteres sem exibi-las e cria a conta desse e-mail com perfil de consulta, mais uma conta fictícia de gestor e dados fictícios. O arquivo isolado não altera `backend/sigpm.sqlite3`, o administrador ou suas permissões. Para iniciar a API da demonstração, em outro terminal execute:

```powershell
py backend/server.py --host 127.0.0.1 --port 8002 --db backend/sigpm-demo-apresentacao.sqlite3
```

Abra `http://127.0.0.1:8002/portal.html` e entre com o e-mail autorizado e a senha de consulta que você definiu. `--create-admin` continua sendo o fluxo independente para o administrador inicial. A base de demonstração é separada da base padrão `backend/sigpm.sqlite3`. Use apenas dados fictícios e não exponha essas contas em uma implantação pública.

## O que está implementado

- API local com persistência SQLite para usuários, secretarias, setores, pessoas/empresas e sessões.
- Senhas derivadas com scrypt; sessões aleatórias armazenadas como hash, expiração, cookie HttpOnly/SameSite e verificação CSRF.
- Papéis básicos (administrador, gestor, atendente e consulta), com autorização validada no backend.
- Registro de auditoria encadeado por hash para autenticações e alterações da API. O encadeamento torna alterações detectáveis, mas não é armazenamento imutável contra um administrador do arquivo/servidor.
- Testes automatizados da API para autenticação, permissões, CSRF, persistência, cadastros relacionados e auditoria.
- Dashboard autenticado com contadores reais de tarefas, documentos e secretarias, vencimentos próximos, atividade recente e gráficos clicáveis por status/secretaria.
- Tarefas privadas por conta: cadastro, consulta detalhada, edição, conclusão/reabertura, arquivamento com confirmação e filtros por título, status, prioridade, período e secretaria.
- Documentos privados por conta: upload real até 8 MB, categorias, edição de metadados, filtro, associação opcional a secretaria, download autenticado e arquivamento.
- Secretarias: cadastro, detalhes, pesquisa e edição administrativa; exclusão bloqueada enquanto houver dados vinculados.
- Login, logout, validação de sessão e permissões permanecem no backend. O painel é responsivo e não usa dados fictícios nem armazenamento local.
- `/cidadao.html` e suas rotas públicas continuam preservados como página separada, sem link no menu principal. Os módulos demonstrativos antigos e o shell `localStorage` foram removidos do fluxo e seus arquivos JavaScript/CSS sem dependências foram apagados; tabelas e registros antigos do SQLite foram preservados.
- As rotas de eventos, planejamento, notificações e demandas continuam disponíveis no backend por compatibilidade com relações e dados existentes; elas não aparecem na navegação principal.

## Limites importantes

O servidor foi preparado para desenvolvimento local e não substitui implantação segura de produção: ainda são necessárias revisão de segurança, HTTPS/proxy, gestão institucional de segredos e sessões, backups testados, política de retenção e avaliação de segurança. As tarefas e documentos do painel são privados por funcionário; a secretaria é uma associação informativa e não altera permissões. **Não use documentos sigilosos nem dados pessoais reais.**

O serviço integrado serve o painel autenticado e o portal do cidadão. Documentos são privados do proprietário, sem compartilhamento entre funcionários. Os módulos antigos de agenda e notificações permanecem apenas no backend para compatibilidade; não fazem parte da navegação simplificada. O limitador de tentativas do portal público é em memória para desenvolvimento. O servidor local não substitui revisão de segurança, backups, HTTPS, governança de acesso e política institucional para implantação real.

## Plano incremental SIGPM

1. **Base (parcial):** API, sessão, papéis básicos, unidades, cadastro de pessoas e trilha de auditoria; faltam administração completa, revogação e gestão detalhada de permissões.
2. **Gestão interna (parcial):** Dashboard, tarefas, documentos e secretarias autenticados; persistem limitações de compartilhamento de arquivos e administração institucional completa. O Portal do Cidadão permanece como página separada.
3. **Tributos e alvarás:** somente após parametrização e validação das regras municipais.
4. **Administração:** RH, jurídico, junta militar, compras, almoxarifado e patrimônio, com áreas restritas próprias.
5. **Finanças e contratação:** licitações, contratos, contabilidade, orçamento e obras.
6. **Áreas finalísticas:** saúde, educação, assistência social, ouvidoria e transparência, condicionadas à governança de dados.
7. **Qualidade:** testes de segurança, desempenho e aceitação institucional para cada fase.

Os gráficos do dashboard são desenhados com HTML/CSS a partir da resposta da API, sem dependência de CDN. A responsividade foi revisada no CSS; a inspeção em navegador dos fluxos autenticados desta versão ainda precisa ser concluída.
#
