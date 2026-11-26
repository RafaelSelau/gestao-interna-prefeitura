# SIGAM — Sistema Integrado de Gestão e Administração Municipal

## Publicar na Vercel com Supabase

O projeto mantém o frontend HTML/CSS/JavaScript e o backend Python WSGI. A Vercel serve as páginas estáticas e executa a API em `api/index.py`. Em produção, a API usa PostgreSQL no Supabase, Supabase Auth para validar senhas e um bucket privado do Supabase Storage para documentos. O arquivo SQLite e `backend/private_files/` continuam somente para execução local.

### Configurar o Supabase

1. Crie um projeto Supabase e escolha a região mais próxima dos usuários.
2. No **SQL Editor**, execute `supabase/migrations/202611120001_sigam_schema.sql`. A migração cria as tabelas atuais e legadas, relacionamentos, índices, RLS e o bucket privado `sigam-documentos`.
3. Execute também `supabase/migrations/202611260001_task_assignee.sql` para habilitar a atribuição de tarefas a servidores.
4. Em **Authentication → Providers → Email**, mantenha o cadastro público desativado. O sistema cria usuários pelo backend administrativo.
5. Em **Project Settings → Database → Connection string**, copie a URL do **Transaction pooler** (porta 6543) para `DATABASE_URL`. Substitua a senha de exemplo do `.env.example` pela senha do banco.
6. Em **Project Settings → API**, copie a URL do projeto e a chave publicável/anon. A chave `service_role` é secreta: ficará somente nas variáveis server-side da Vercel.
7. Crie a conta do primeiro administrador em **Authentication → Users → Add user**. Depois abra `supabase/bootstrap_admin.sql`, troque o e-mail e o nome de exemplo e execute no **SQL Editor**. Atualize a página de login e entre com esse e-mail.

### Configurar a Vercel

1. Importe o repositório `RafaelSelau/gestao-interna-prefeitura` na Vercel. A raiz do projeto é a raiz do repositório; não defina uma pasta de frontend separada.
2. Em **Settings → Environment Variables**, cadastre estas variáveis para **Production**, **Preview** e **Development**:

   - `DATABASE_URL`: string do Transaction pooler Supabase.
   - `SUPABASE_URL`: URL do projeto, como `https://<project-ref>.supabase.co`.
   - `SUPABASE_ANON_KEY`: chave publicável/anon do projeto.
   - `SUPABASE_SERVICE_ROLE_KEY`: chave `service_role`/secret, marcada como secreta e nunca prefixada com `VITE_`, `NEXT_PUBLIC_` ou equivalente.

3. Faça o primeiro deploy pela Vercel. Os próximos commits na branch conectada serão publicados automaticamente.
4. Em **Supabase → Authentication → URL Configuration**, defina o domínio de produção da Vercel como **Site URL**. Se adicionar login por link de e-mail no futuro, inclua também os domínios de Preview nas URLs permitidas.
5. Abra `/portal.html`, crie usuários municipais pela administração do sistema e confira login, tarefas, documentos, secretarias e dashboard.

As contas existentes que ainda usam hash scrypt são verificadas localmente uma vez no primeiro login com a senha atual e então vinculadas ao Supabase Auth. Para isso, o nome de usuário precisa ser atualizado para o e-mail da conta no Supabase. Contas sem e-mail válido precisam ser criadas novamente pelo administrador. Senhas não são copiadas em texto puro.

O esquema é criado pelo arquivo de migração; o deploy **não copia automaticamente** os registros do SQLite para o novo projeto. Antes de abrir o sistema para uso, decida quais registros locais devem ser preservados e migre apenas dados revisados. Não use dados fictícios nem documentos pessoais reais em produção sem a autorização e a governança municipal apropriadas.

### Página pública, SEO e Google Search Console

A URL Vercel atualmente atribuída ao projeto é `https://gestao-interna-prefeitura.vercel.app/`. A página inicial pública apresenta o SIGAM — Sistema Integrado de Gestão e Administração Municipal da Prefeitura Municipal de Morrinhos do Sul – RS. A raiz `/` é a URL canônica; `/index.html` e `/welcome.html` redirecionam para ela. O painel usa `/login` (atalho para `/portal.html`) e permanece protegido pela autenticação da API. A implantação exige as quatro variáveis listadas acima em Production; os valores ficam na Vercel e não devem ser incluídos no repositório.

O `robots.txt` aponta para `https://gestao-interna-prefeitura.vercel.app/sitemap.xml`. O sitemap contém somente a página inicial pública. Login, dashboard, portal do cidadão e API recebem `noindex`; a API também fica bloqueada para rastreamento. As páginas marcadas com `noindex` não devem ser bloqueadas no `robots.txt`, pois o Google precisa rastreá-las para ler a diretiva. O painel continua exigindo autenticação independentemente das diretivas de SEO.

Para cadastrar o site no Google Search Console:

1. Abra [Google Search Console](https://search.google.com/search-console/) e adicione uma propriedade de **Prefixo do URL** com `https://gestao-interna-prefeitura.vercel.app/` (incluindo `https://` e a barra final).
2. Escolha um método de verificação oferecido pelo Search Console, como **Tag HTML** ou **Arquivo HTML**. Use exatamente o token/arquivo fornecido à sua conta: não existe código de verificação pré-configurado neste repositório. Se usar tag ou arquivo, adicione-o sem substituir os metadados da página e publique novamente; não compartilhe credenciais do Search Console.
3. Depois da propriedade verificada, abra **Sitemaps**, informe `sitemap.xml` e envie.
4. Em **Inspeção de URL**, informe `https://gestao-interna-prefeitura.vercel.app/`, execute o teste de URL publicada e use **Solicitar indexação** se estiver acessível e rastreável. Repita apenas para outras páginas públicas canônicas; as áreas internas ficam fora do sitemap e com `noindex`. A solicitação não garante inclusão ou posição nos resultados; confirme o estado depois em Search Console.

O domínio `.vercel.app` é o domínio padrão atual. Para usar domínio municipal próprio, adicione-o em **Vercel → Project → Settings → Domains**, configure os registros DNS exibidos pela Vercel e atualize `canonical`, Open Graph, `robots.txt`, `sitemap.xml` e a propriedade do Search Console para o domínio escolhido. A indexação real só deve ser confirmada no Search Console depois do rastreamento do Google.

### Desenvolvimento local

Para desenvolvimento, a API continua usando SQLite local e o fluxo atual de configuração inicial. As variáveis de Supabase são exigidas somente pela função Vercel. Dependências e comandos locais continuam descritos nas seções abaixo.

## Executar localmente

Python 3.10 ou superior não exige pacotes extras. Inicie o servidor integrado pela pasta do projeto:

```powershell
py backend/server.py --host 127.0.0.1 --port 8001
```

Abra `http://127.0.0.1:8001/` para a página institucional do SIGAM e selecione **Acessar o sistema**. O login (ou a configuração inicial local, se ainda não houver administrador) fica em `/portal.html`. Após autenticar, o sistema abre o dashboard em `/produtividade.html`. O menu principal contém apenas **Dashboard**, **Tarefas**, **Documentos**, **Secretarias** e **Sair da conta**. `/index.html` e `/welcome.html` redirecionam à raiz. Se a porta estiver ocupada, escolha outra porta e use-a nos endereços. Para encerrar, pressione **Ctrl+C**. O banco SQLite é criado em `backend/sigpm.sqlite3`; não publique esse arquivo.

Se uma instância antiga do servidor já estiver usando a porta `8001`, pare-a com **Ctrl+C** no terminal dela e execute novamente o comando acima. O painel verifica a versão da API e mostra uma orientação explícita quando frontend e backend estão em versões diferentes.

As páginas internas exigem uma sessão válida no servidor integrado. O sistema não usa `localStorage` para tarefas, documentos ou dados de dashboard.

Rotas principais do painel: `/dashboard`, `/tarefas`, `/documentos` e `/secretarias` carregam o shell autenticado e continuam válidas após atualização direta do navegador. A API oferece `GET /api/dashboard`, CRUD de `/api/tasks`, `/api/documents` e `/api/departments`. Login retorna cookie de sessão HttpOnly e token CSRF. Operações internas de escrita exigem o token no cabeçalho `X-CSRF-Token`. Outras rotas e tabelas antigas permanecem no backend para compatibilidade e preservação dos registros existentes.

O administrador inicial é criado pelo formulário local de `/portal.html` ou pelo comando `--create-admin`. Não existe conta nem fluxo de demonstração; todo acesso ao painel exige uma sessão válida. A tela de Secretarias permite cadastro, edição e exclusão para administradores. Uma secretaria só pode ser excluída se não tiver vínculos com setores, usuários, demandas, tarefas ou documentos.

Os testes da API rodam com `py -m unittest discover -s backend/tests -t . -v`.

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
- `/cidadao.html` e suas rotas públicas continuam preservados como página separada, sem link no menu principal. O antigo pacote duplicado de publicação foi isolado em `.vercelignore` para que seu código legado não seja publicado.
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
