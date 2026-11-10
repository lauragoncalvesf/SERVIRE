# Confirmação de e-mail e recuperação de senha — SERVIRE

## Habilitar a recuperação

A recuperação exige **autorização do vínculo entre conta e endereço** e **confirmação da caixa postal**. São condições distintas. Contas existentes e futuras começam com os dois estados pendentes. Login e cadastro continuam funcionando sem habilitar a recuperação; o e-mail permanece obrigatório no cadastro atual. Não há envio automático ao cadastrar membros ou aceitar convites administrativos.

- **Titular que sabe sua senha:** em Meu Perfil, confere o endereço e informa a senha atual para solicitar a confirmação. A reautenticação autoriza o vínculo; o link recebido comprova posse do endereço. A tela distingue pendente de confirmado.
- **Titular que esqueceu a senha antes de habilitar:** procura o responsável pelo cadastro. ADMIN pode autorizar apenas MEMBRO da própria paróquia, incluindo coordenadores. SUPER_ADMIN pode autorizar ADMIN. Não há autorização administrativa da própria conta, de outro ADMIN por ADMIN, ou de MEMBRO por SUPER_ADMIN.
- **Responsável administrativo:** confere a identidade e o vínculo com o endereço por canal independente (presencial ou contato previamente conhecido), marca a declaração e confirma sua própria senha. A autorização é auditada e não envia mensagem. Uma segunda ação explícita envia a confirmação ao titular. O sistema registra a declaração; a qualidade da conferência humana depende do procedimento da organização.
- **SUPER_ADMIN sem senha e sem recuperação habilitada:** requer suporte operacional externo com verificação independente da identidade e procedimento auditado. Não foi criado endpoint de bootstrap, exceção pública ou ferramenta de recuperação direta do banco. Esse procedimento operacional deve ser definido antes da publicação.

Confirmar o endereço não autentica o usuário nem troca a senha. Abrir a página não consome o token: é preciso clicar no botão. Isso reduz consumo acidental por verificadores de links. O estado atualizado aparece ao abrir novamente Meu Perfil.

## Solicitar e redefinir

O link “Esqueci minha senha” no login solicita e-mail e a mesma identificação de paróquia usada no login. Escopo vazio corresponde exclusivamente a conta global SUPER_ADMIN. O mesmo endereço em duas paróquias não mistura contas. Dados legados com duplicidade que difere apenas em maiúsculas/minúsculas dentro do mesmo escopo não geram envio: precisam de revisão administrativa, sem escolher uma conta arbitrária.

Para uma solicitação sintaticamente válida, a API devolve sempre HTTP 202 e a mesma mensagem, sem revelar existência, autorização, confirmação, estado da conta ou resultado do provedor. A busca e o envio são executados após a resposta. A fila transitória tem até 64 operações, concorrência 2 e nenhum processamento periódico. Não é persistente: reinício ou sobrecarga pode perder uma solicitação, que pode ser refeita respeitando os limites.

A redefinição exige token válido e senha com pelo menos 12 caracteres, letras e números e no máximo 72 bytes, diferente da atual. Consome o token uma única vez em transação serializável com bloqueio da conta, grava bcrypt, incrementa `versaoSessao` e invalida todos os tokens de segurança e convites administrativos pendentes. Sessões anteriores são recusadas pelo middleware existente. Não há login automático.

## Endpoints

| Método e rota | Acesso e dados |
|---|---|
| POST `/auth/esqueci-senha` | Público: `{ email, paroquiaId }`; 202 genérico |
| POST `/auth/redefinir-senha` | Público: `{ token, novaSenha, confirmarSenha }` |
| POST `/auth/confirmar-email` | Público: `{ token }` |
| POST `/meu-perfil/email/confirmacao` | Autenticado: `{ senhaAtual, emailEsperado }` |
| POST `/usuarios/:id/email/autorizar` | ADMIN: `{ senhaAtual, emailEsperado, identidadeConferida: true }` |
| POST `/usuarios/:id/email/confirmacao` | ADMIN: `{ senhaAtual, emailEsperado }` |
| POST `/superadmin/admins/:id/email/autorizar` | SUPER_ADMIN: mesmos campos da autorização |
| POST `/superadmin/admins/:id/email/confirmacao` | SUPER_ADMIN: mesmos campos da confirmação |

`emailEsperado` impede autorizar silenciosamente um endereço alterado entre a abertura da tela e a operação. IDs pessoais vêm da sessão. Campos adicionais são rejeitados. Nenhum desses endpoints retorna token ou link, inclusive em falha de envio. O fluxo manual dos **convites administrativos** permanece independente e intacto.

## Tokens, limites e envio

- Tokens de 32 bytes aleatórios, 30 minutos, finalidade específica, uso único e armazenamento apenas do SHA-256. O registro também vincula hash do endereço e versão da sessão. Endereços autorizados precisam permanecer ativos, com paróquia ativa quando aplicável.
- Solicitações públicas: 5 por IP/15 minutos; consumo de confirmação e redefinição: 20 por IP/15 minutos em cada rota. Operações privadas: 10 por IP/15 minutos em cada grupo de operação, além de senha atual obrigatória.
- Cada conta/finalidade: intervalo de 60 segundos e até 3 emissões por hora, incluindo tentativas cujo envio falhou. Nova emissão invalida o token anterior da mesma finalidade. Contadores são persistidos atomicamente em `LoginAttempt`, com chaves SHA-256 e namespaces separados do login. Os limites não dependem da memória de uma réplica.
- Resend HTTPS reutilizado, remetente `SERVIRE <convites@send.servirepastoral.com.br>`, HTML com dados escapados e texto simples. Prefixos de idempotência separados: `confirmacao-email/` e `recuperacao-senha/`, seguidos do hash do token. `convite-admin/` e seus 48h continuam preservados. Envio ocorre fora da transação, sem retry automático ou fallback SMTP.
- Links públicos usam `FRONTEND_URL` validada (padrão `https://servirepastoral.com.br`) e fragmento `#token=...`; as páginas removem o fragmento da barra e mantêm o token apenas na memória do componente. Não há localStorage para esses tokens. Respostas da operação usam `Cache-Control: no-store`.
- Logs do provedor continuam sanitizados como `resend_falha`. A fila registra somente `seguranca_email` com `FILA_OCUPADA` ou `FALHA_PROCESSAMENTO`. Não registra e-mail, senha, token, link, conteúdo ou erro bruto. Falhas de entrega não liberam recuperação nem desfazem indevidamente autorização ou cadastro.

## Migration e compatibilidade

Migration incremental: `backend/prisma/migrations/20261109000100_confirmacao_recuperacao_email/migration.sql`.

1. Adiciona três colunas nullable em `Usuario`: `emailAutorizadoEm`, `emailAutorizadoPor` (identificador histórico do autorizador) e `emailConfirmadoEm`. **Sem backfill ou autorização automática**, sem alterar senhas/e-mails/versões existentes na aplicação da migration.
2. Cria enum e tabela `TokenSeguranca`, hash único, FK com exclusão em cascata, índices para invalidação e expiração, e restrições de integridade para autorização/confirmação e prazo.
3. Cria trigger em `Usuario`: mudança efetiva do e-mail remove autorização e confirmação e incrementa a versão de sessão; mudanças de versão, senha, atividade, tipo ou paróquia invalidam tokens pendentes. Isso cobre Editar Usuários, Meu Perfil e as demais rotas existentes, sem depender de cada controller lembrar a revogação. Voltar ao endereço anterior não restaura a confirmação antiga. Alteração apenas de caixa/espaços não muda a identidade normalizada do endereço.

O trigger é parte necessária da segurança: não o desabilite em rotinas administrativas. Metadata de confirmação não é aceita nos payloads de edição existentes. A migration é aditiva, mas DDL exige locks breves; revisar volume e janela de publicação. Não há rollback destrutivo automatizado. Rollback de aplicação preserva a tabela/trigger e a revogação de segurança. Para Prisma/client antigo, as colunas adicionais são compatíveis.

## Validação local, sem e-mails reais

```bash
npm test --prefix backend
npm test --prefix frontend
npm run lint --prefix frontend
npm run build --prefix frontend
cd backend
npx prisma validate
# Servidor PostgreSQL LOCAL descartável, nome novo; nunca usar URL de produção:
TEST_DATABASE_URL=postgresql://usuario@127.0.0.1:5432/servire_test_seguranca_unico npm run test:seguranca:integration
TEST_DATABASE_URL=postgresql://usuario@127.0.0.1:5432/servire_test_regressao_unico npm run test:integration
```

As integrações abortam se o host não for localhost/127.0.0.1 ou se o nome não começar por `servire_test_`. Criam bases novas e deixam os dados descartáveis para inspeção, sem apagar bases preexistentes. A integração de segurança simula o envio e testa migrations sobre conta legada e instalação completa, concorrência, hierarquia, isolamento, trigger e rollback. Unitários/DOM usam mocks; `NODE_ENV=test` bloqueia o Resend real.

Resultado desta implementação: **188 testes backend**, **19 testes frontend**, **50 verificações PostgreSQL de segurança** e **56 verificações PostgreSQL de regressão** aprovados. Lint, build e validação do schema aprovados. Build conserva aviso de bundle acima de 500 kB. Não houve validação visual em navegador real nem envio/entrega real.

## Publicação futura, com autorização

1. Revisar diff e backup do PostgreSQL, conferir migrations pendentes e testar em homologação. Definir o procedimento de conferência independente e suporte de contas não habilitadas, especialmente SUPER_ADMIN.
2. Manter Node 22, `RESEND_API_KEY` somente no backend e `FRONTEND_URL=https://servirepastoral.com.br`. Nenhuma variável nova. Conferir `PROXY_HOPS` já existente para que `req.ip` reflita a cadeia real de proxies; não confiar em headers arbitrários. Um IP compartilhado pode limitar vários usuários; IPs distribuídos podem exigir proteção adicional na borda.
3. Aplicar a migration com o procedimento de publicação existente (`prisma migrate deploy`) e gerar o client antes de iniciar o backend novo. Só depois publicar o frontend. Não iniciar backend novo sem a migration. Não habilitar contas em massa nem marcar endereços antigos como confirmados.
4. Fazer teste controlado de confirmação e recuperação com destinatário autorizado, apenas quando houver autorização explícita de envio real. Verificar revogação das outras sessões, endereço/paróquia e ausência de segredos nos logs. Convites administrativos mantêm contrato e funcionamento anteriores.
5. Monitorar erros sanitizados, fila, limites e entregas no painel Resend. Não foi adicionada outbox, webhook, cron ou limpeza automática de histórico; a retenção de tokens consumidos/auditoria precisa de política operacional proporcional ao volume.

Nenhum comando de publicação, commit, push, acesso ao banco de produção, mudança no Railway/DNS/Nginx ou e-mail real foi executado nesta implementação.

## Arquivos desta implementação

Criados:

- `backend/prisma/migrations/20261109000100_confirmacao_recuperacao_email/migration.sql`.
- `backend/src/controllers/segurancaContaController.js`.
- `backend/src/routes/segurancaContaRoutes.js`.
- `backend/src/middlewares/limitarSeguranca.js`.
- `backend/src/services/segurancaContaService.js`, `emailSegurancaService.js`, `limiteSegurancaService.js` e `filaSegurancaService.js`.
- `backend/tests/segurancaConta.test.js`, `emailSeguranca.test.js` e `integration/segurancaConta.js`.
- `frontend/src/components/ConfirmacaoEmailPerfil.jsx`, `AutorizarEmailModal.jsx` e `EmailSeguranca.test.jsx`.
- `frontend/src/pages/SegurancaConta.jsx` e `SegurancaConta.test.jsx`.
- `docs/RECUPERACAO_SENHA.md`.

Modificados:

- `backend/prisma/schema.prisma` e `backend/package.json` (script de integração, sem nova dependência).
- `backend/src/app.js`, `middlewares/auth.js`, `services/perfilService.js` e `services/resendEmailService.js`.
- `backend/tests/resendEmail.test.js` (prefixos isolados de idempotência).
- `frontend/src/App.jsx` e páginas `Login.jsx`, `MeuPerfil.jsx`, `Usuarios.jsx`, `Superadmin.jsx`.
- `README.md`, `docs/EMAIL_CONVITES.md` e `docs/MEU_PERFIL.md`.
