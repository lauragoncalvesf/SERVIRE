# Meu Perfil — SERVIRE

Página `/meu-perfil`, no menu existente, para `SUPER_ADMIN`, `ADMIN` e `MEMBRO`, incluindo coordenadores por vínculo ativo `MembroPastoral`. Coordenação não vira tipo global de usuário.

## Funcionalidades

- Visualização dos dados cadastrais e nível de acesso somente leitura.
- Edição de nome e e-mail, com confirmação de senha atual quando o e-mail muda.
- Alteração de senha em formulário separado, com confirmação, mostrar/ocultar e feedback de carregamento, erro e sucesso.
- Atualização imediata do perfil e do nome no menu, sem recarregar a página.
- Layout e temas existentes, formulários responsivos e campos com rótulos acessíveis.
- Cartão de e-mail para recuperação: estado pendente/confirmado e solicitação explícita com senha atual, sem envio automático no cadastro.

## API autenticada

| Método | Endpoint | Dados |
|---|---|---|
| GET | `/meu-perfil` | Perfil seguro do usuário da sessão, paróquia e coordenações |
| PATCH | `/meu-perfil` | `{ nome, email, senhaAtual? }` — senha exigida se mudar e-mail |
| PUT | `/meu-perfil/senha` | `{ senhaAtual, novaSenha, confirmarSenha }` |

O ID e a paróquia vêm do middleware JWT. Campos adicionais, incluindo `id`, `tipo`, `ativo`, `paroquiaId` e `versaoSessao`, são rejeitados. As respostas usam `Cache-Control: no-store` e nunca retornam hash/senha. Erros de senha atual retornam 403, preservando a sessão para correção; sessão inválida retorna 401. Entradas inválidas retornam 400 e e-mail indisponível retorna 409 sem revelar outra conta.

Nome é obrigatório, até 200 caracteres. E-mail é normalizado com trim e minúsculas e validado. Duplicidade respeita a regra existente: e-mail único dentro da paróquia; contas globais usam o escopo nulo e índice único parcial existente. A verificação ignora diferenças de caixa. A confirmação e autorização do endereço agora são tratadas no cartão de recuperação descrito em [Recuperação de senha](RECUPERACAO_SENHA.md); endereços existentes começam pendentes.

A nova senha segue a política dos convites: 12 caracteres ou mais, letras e números e máximo de 72 bytes. A senha atual é validada com bcrypt; senhas legadas mais curtas continuam válidas como senha atual. Reutilização é rejeitada por comparação bcrypt. Nenhuma senha é registrada em logs ou localStorage.

As duas operações de gravação reutilizam o limitador de login (10 tentativas por janela de 15 minutos, inclusive por IP). Esse orçamento é compartilhado com o login; a mensagem preexistente do limitador menciona login. Não foram alteradas as configurações do limitador.

## Sessões e convites

Alterar somente o nome mantém o token e as outras sessões. Alterar e-mail ou senha incrementa `versaoSessao`, invalida convites anteriores ainda não consumidos e emite token JWT renovado para a sessão atual. O frontend substitui token e usuário no contexto/localStorage após sucesso. Os tokens anteriores deixam de funcionar, inclusive nas outras sessões.

As alterações e a auditoria ocorrem na transação serializável existente. A versão de sessão é conferida novamente dentro da transação para bloquear alterações concorrentes feitas com uma sessão já revogada. Assinatura JWT usa o mesmo serviço agora compartilhado com o login; algoritmo e prazo continuam HS256 e 7 dias.

O Superadministrador recebe acesso somente às rotas pessoais explícitas, além das rotas globais que já possuía; não ganha acesso às operações pastorais. A proteção frontend permite o perfil pessoal sem relaxar a proteção do painel global ou de outras páginas.

## Testes locais

Com dependências instaladas:

```bash
cd backend
npm test
cd ../frontend
npm test
npm run build
npm run lint
```

Para executar manualmente, use banco e variáveis de desenvolvimento já configurados:

```bash
# Terminal 1
cd backend
npm run dev
# Terminal 2
cd frontend
npm run dev
```

1. Entre com uma conta de desenvolvimento e abra **Meu Perfil**.
2. Salve outro nome e confira a atualização no menu.
3. Troque o e-mail: confirme que a senha atual é exigida e que erro de senha não encerra a sessão. Após sucesso, use o novo endereço no próximo login.
4. Troque a senha: confira confirmação, política, mostrar/ocultar e rejeição da senha anterior. Em uma segunda sessão, o token anterior deve ser recusado.
5. Repita o acesso com Superadministrador e coordenador; confira que cargo e paróquia não são editáveis.

Testes backend usam Prisma simulado e bcrypt/JWT reais, sem acessar banco. Testes frontend usam Vitest, JSDOM e Testing Library como dependências de desenvolvimento, com API simulada; verificam permissões pessoais, dados somente leitura, atualização do menu/localStorage, token renovado, erros, confirmação de senha e bloqueio durante gravação.

A implementação original do perfil não exigiu migration. A funcionalidade posterior de confirmação/recuperação exige a migration e a revogação automática descritas em [Recuperação de senha](RECUPERACAO_SENHA.md). Não houve acesso ao banco de produção, envio de e-mail, alteração no Railway, commit, push ou deploy. Não foi realizada inspeção visual em navegador real; os testes de interface usam DOM simulado.

## Resultado da validação original do perfil

- Backend: **152 testes aprovados**, sem falhas (14 novos testes de perfil e acesso global pessoal).
- Frontend: **10 testes aprovados**, com Vitest/JSDOM.
- Build e lint do frontend aprovados; permanece o aviso preexistente de bundle acima de 500 kB.
- Sintaxe dos arquivos backend alterados e `git diff --check` aprovados.
- Nenhum teste acessou banco ou SMTP real. A integração PostgreSQL não foi reexecutada; não houve mudança de schema.

## Arquivos

Criados: `backend/src/services/sessaoService.js`, `backend/src/services/perfilService.js`, `backend/src/controllers/perfilController.js`, `backend/src/routes/perfilRoutes.js`, `backend/tests/perfil.test.js`, `frontend/src/pages/MeuPerfil.jsx`, `frontend/src/pages/MeuPerfil.css`, `frontend/src/pages/MeuPerfil.test.jsx`, `frontend/vitest.config.js`, `docs/MEU_PERFIL.md`.

Modificados: `backend/src/app.js`, `backend/src/controllers/authController.js`, `backend/src/middlewares/auth.js`, `backend/tests/auth.test.js`, `frontend/package.json`, `frontend/package-lock.json`, `frontend/src/App.jsx`, `frontend/src/components/AppLayout.jsx`, `frontend/src/components/ProtectedRoute.jsx`, `frontend/src/contexts/AuthContext.jsx`.
