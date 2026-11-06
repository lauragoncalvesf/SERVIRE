# Administração global do SERVIRE

Implementação local, sem commit, push, deploy ou acesso ao banco do `.env` durante a validação.

## Funcionalidades e decisões

- Login único em `/login`. Contas paroquiais informam o ID da paróquia; a conta global deixa esse campo vazio. O backend consulta o perfil atual e a atividade da conta/paróquia, sem confiar no perfil enviado.
- Painel `/superadmin`: indicadores reais, busca por nome/cidade, status, paginação de 20 paróquias, cadastro, detalhes, edição, ativação/desativação e administradores por paróquia.
- Cadastro de administrador sempre fixa `ADMIN`, com senha aleatória desconhecida; o administrador define a senha por convite de 48 horas. O link aparece uma única vez na resposta da operação e no diálogo da interface. Não existe envio de e-mail configurado/implementado.
- Convites têm 256 bits de entropia, somente SHA-256 persistido, consumo condicional e transação serializável. Nova emissão invalida convites anteriores. Senha exige 12 caracteres com letras e números e no máximo 72 bytes (limite do bcrypt). Não há senha compartilhada.
- Transferência ocorre entre administradores ativos da mesma paróquia. O sucessor deve ter aceitado o convite; o anterior passa a membro. Não movemos usuários e seus históricos para outra paróquia.
- Contas globais não acessam operações pastorais autenticadas. `ADMIN` permanece limitado à própria paróquia. Coordenação permanece em `MembroPastoral.papel`, podendo incluir diversas pastorais.
- `versaoSessao` revoga tokens em alterações administrativas de conta e de status paroquial. Tokens antigos sem versão correspondem à versão zero; nunca voltam a funcionar depois de uma desativação/reativação efetuada pelo painel.
- Edição de usuários pela API paroquial também revoga sessão, invalida convites, protege o último administrador e registra auditoria dentro da mesma transação. Campos aceitos são selecionados explicitamente.
- Desativar preserva todos os relacionamentos e dados; reativar não muda o status individual dos usuários.
- Duplicidade de paróquia: nome, cidade e UF iguais, sem diferenciar maiúsculas/minúsculas no nome e cidade, rejeitada em transação serializável. E-mail de novos administradores normalizado e verificado sem diferenciar caixa dentro da paróquia; a unique existente continua preservada.
- Auditoria registra autor, ação, recurso, ID e data, sem senhas/tokens e sem dados pessoais desnecessários. O autor permanece como ID histórico, sem exclusão em cascata de registros de auditoria.
- Listagem pública preexistente `GET /paroquias` mantém somente dados públicos de paróquias ativas. O antigo `POST /paroquias` foi removido: todo cadastro passa pela API global auditada.

## Migrações

1. `20261105000100_superadmin`: acrescenta valor ao enum.
2. `20261105000200_contas_globais`: vínculo opcional no Prisma, CHECK PostgreSQL exigindo paróquia para `ADMIN`/`MEMBRO` e ausência para `SUPER_ADMIN`, índice único parcial para e-mail global, versão de sessão, convites e auditoria.

Separar as duas migrações evita usar um novo valor de enum antes de seu commit no PostgreSQL. Não há reset, remoção ou recriação de tabelas existentes. O CHECK e o índice parcial são mantidos pelo SQL, pois o schema Prisma não representa essas restrições integralmente.

## API

Todas as rotas `/superadmin/*` exigem JWT e `SUPER_ADMIN` atual do banco:

| Método | Caminho | Finalidade |
|---|---|---|
| GET | `/superadmin/dashboard` | Totais reais |
| GET, POST | `/superadmin/paroquias` | Listar/criar; query `busca`, `status=ativa/inativa`, `pagina` |
| GET, PUT | `/superadmin/paroquias/:id` | Detalhes/editar |
| PATCH | `/superadmin/paroquias/:id/status` | Corpo `{ "ativa": true }` |
| GET, POST | `/superadmin/paroquias/:id/admins` | Listar/criar administradores |
| PUT | `/superadmin/admins/:id` | Nome, e-mail, telefone |
| PATCH | `/superadmin/admins/:id/status` | Corpo `{ "ativo": true }` |
| POST | `/superadmin/admins/:id/convite` | Novo convite e invalidação do anterior |
| POST | `/superadmin/admins/:id/transferir` | Corpo `{ "sucessorId": 123 }` |

`GET /auth/sessao` exige JWT e retorna somente campos seguros. `POST /auth/aceitar-convite` recebe `{ token, senha }`, com limitador de tentativas compartilhado com login. Tokens são retornados somente na criação/emissão do convite, com `Cache-Control: no-store`. A interface usa fragmento `#token=...`, removido após abertura, para evitar envio do segredo em URLs ao servidor/referer.

## Validação local

Node 22, dependências já instaladas:

```bash
cd backend
npx prisma generate
npx prisma validate
npm test
cd ../frontend
npm run build
npm run lint
```

Testes unitários usam mocks e não acessam banco real. Integração exige PostgreSQL **descartável local**; o script rejeita host remoto e banco sem prefixo `servire_test_`. Ele cria a base informada e uma segunda base com sufixo `_deploy`, falha se já existirem e não apaga bancos. Escolha nomes novos em cada execução:

```bash
cd backend
TEST_DATABASE_URL=postgresql://USUARIO@127.0.0.1:PORTA/servire_test_execucao_1 npm run test:integration
```

A integração aplica migrações anteriores, insere dados legados, aplica as novas e confere preservação. Em outra base, roda `prisma migrate deploy` de ponta a ponta. Valida CHECK, isolamento, perfis, coordenação múltipla, convites, status, revogação, transferência, proteção do último administrador e rollback quando a auditoria falha.

Para iniciar a aplicação local com **banco de desenvolvimento** configurado:

```bash
cd backend
npx prisma migrate deploy
npm run dev
# Em outro terminal:
cd frontend
npm run dev
```

## Primeiro Superadministrador

Script manual: `backend/scripts/criarSuperadmin.js` / `npm run superadmin:criar`. Usa o PrismaPg existente, bcrypt, valida entradas, serializa a inicialização com advisory lock, fecha a conexão e nunca imprime senha/hash. Recusa qualquer alteração de conta existente; portanto não promove implicitamente usuários nem altera credenciais. Recusa bootstrap se já houver qualquer Superadministrador, inclusive inativo.

Depois de autorizar a operação e selecionar conscientemente o ambiente, execute em terminal Bash privado conectado ao serviço backend correto, com `DATABASE_URL` já configurada nesse processo:

```bash
read -r -p 'Nome: ' SUPERADMIN_NOME
read -r -p 'E-mail: ' SUPERADMIN_EMAIL
read -r -s -p 'Senha (12+ caracteres, letras e números): ' SUPERADMIN_SENHA
printf '\n'
export SUPERADMIN_NOME SUPERADMIN_EMAIL SUPERADMIN_SENHA
npm run superadmin:criar
unset SUPERADMIN_NOME SUPERADMIN_EMAIL SUPERADMIN_SENHA
```

Não coloque esses valores no código, `.env` versionado, histórico de comandos, variáveis permanentes do Railway ou logs. Não execute o script no build/start/pre-deploy. Use um e-mail separado se já houver conta paroquial com o mesmo e-mail. Login global deixa o ID de paróquia vazio.

## Publicação no Railway (manual, após autorização)

1. Faça backup do PostgreSQL e revise o diff e as duas migrações. Confira dados e ambiente antes de executar comandos. Se houver e-mails antigos iguais que diferem apenas na caixa dentro da mesma paróquia, revise esses casos antes do rollout; não há normalização destrutiva em massa.
2. Versione/push somente após aprovação. Mantenha os Root Directories existentes.
3. Backend: build `npm ci && npx prisma generate`; pre-deploy `npx prisma migrate deploy`; start `npm start`. Publique backend e migrações antes do frontend para que `/auth/sessao` já exista.
4. Frontend: build `npm run build`; start `npx --yes serve@14 -s dist -l tcp://0.0.0.0:$PORT`.
5. Preserve `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV`, `PROXY_HOPS`, `CORS_ORIGINS`, `VITE_API_URL`; nenhuma variável nova é obrigatória para os serviços. `SUPERADMIN_NOME`, `SUPERADMIN_EMAIL`, `SUPERADMIN_SENHA` são temporárias, só para bootstrap. `TEST_DATABASE_URL` é exclusiva dos testes locais.
6. Com autorização específica, rode uma vez o bootstrap no ambiente backend de produção. Não é executado automaticamente por esta implementação.
7. Confira login global, indicadores, cadastro de paróquia e convite. Abra o convite em sessão privada, defina senha e confirme login paroquial. Teste bloqueio de rotas globais com perfil comum e desativação/reativação.
8. Em caso de regressão, preserve as migrações aditivas; não execute reset ou rollback destrutivo. Reverta código de forma coordenada, considerando o frontend dependente de `/auth/sessao` e a nova conta global.

## Futura entrega por e-mail

Integre um serviço de envio no fluxo de emissão, usando origem frontend configurada e confiável. Use uma fila/outbox transacional para não informar entrega antes de confirmação do provedor. Não persista tokens em texto puro nem registre o link em logs. A versão atual apresenta claramente que **nenhum e-mail foi enviado** e fornece o link ao operador uma única vez.

## Resultado da validação

- 105 testes automatizados aprovados, nenhuma falha.
- 56 verificações de integração em PostgreSQL 15 descartável aprovadas, incluindo bootstrap e rejeição de duplicação, migrações com dados existentes, deploy completo e rollback por falha de auditoria.
- Prisma Client 7.10 gerado e schema válido.
- Build Vite e lint do frontend aprovados; sintaxe do backend e `git diff --check` aprovados.
- O erro simulado de auditoria produz intencionalmente um registro sanitizado de erro no teste de rollback.

## Limites da verificação

Build/lint não substituem teste visual. Não foi executada automação de navegador nem validação no Railway. O teste de migração usa PostgreSQL local 15 com dados legados representativos; é necessário conferir backup e dados reais antes da publicação autorizada. Nenhum comando de produção foi executado. O build mantém aviso de bundle maior que 500 kB.

## Arquivos criados

- `backend/prisma/migrations/20261105000100_superadmin/migration.sql`
- `backend/prisma/migrations/20261105000200_contas_globais/migration.sql`
- `backend/scripts/criarSuperadmin.js`
- `backend/src/controllers/superadminController.js`
- `backend/src/routes/superadminRoutes.js`
- `backend/src/services/superadminService.js`
- `backend/tests/superadmin.test.js`
- `backend/tests/integration/superadmin.js`
- `frontend/src/pages/Superadmin.jsx`
- `frontend/src/pages/Superadmin.css`
- `frontend/src/pages/AceitarConvite.jsx`
- `docs/SUPERADMIN.md`

## Arquivos modificados

- `backend/package.json`
- `backend/prisma/schema.prisma`
- `backend/src/app.js`
- `backend/src/controllers/authController.js`
- `backend/src/controllers/usuarioController.js`
- `backend/src/middlewares/auth.js`
- `backend/src/middlewares/limitarLogin.js`
- `backend/src/middlewares/tratarErros.js`
- `backend/src/routes/paroquiaRoutes.js`
- `backend/tests/auth.test.js`
- `backend/tests/login.test.js`
- `backend/tests/paroquias.test.js`
- `backend/tests/usuarios.test.js`
- `frontend/src/App.jsx`
- `frontend/src/components/AppLayout.jsx`
- `frontend/src/components/ProtectedRoute.jsx`
- `frontend/src/components/PublicRoute.jsx`
- `frontend/src/contexts/AuthContext.jsx`
- `frontend/src/pages/Login.jsx`
- `frontend/src/utils/formatters.js`
