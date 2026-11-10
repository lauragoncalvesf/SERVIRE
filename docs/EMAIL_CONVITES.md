# Envio automático de convites — SERVIRE

Os convites agora usam a **API HTTPS do Resend**, pelo SDK oficial `resend` 6.37.0, compatível com Node.js 22 (requer Node >=20). O frontend é servido pelo Nginx, mas não participa do envio. Backend de autenticação, permissões, banco, migrations, DNS e Nginx não foram alterados nesta integração. A funcionalidade posterior de [confirmação de e-mail e recuperação de senha](RECUPERACAO_SENHA.md) reutiliza esse transporte, com tokens e endpoints separados; não altera os convites.

## Variáveis do backend

| Variável | Uso |
|---|---|
| `RESEND_API_KEY` | Obrigatória para envio. Lida exclusivamente de `process.env.RESEND_API_KEY`; já configurada no Railway segundo o contexto informado. Não foi consultada, exibida ou alterada nesta implementação. |
| `FRONTEND_URL` | Origem pública HTTPS para os links. Produção: `https://servirepastoral.com.br`. Se ausente, esse domínio oficial é usado como padrão. Se fornecida mas inválida/vazia, nenhum envio é tentado. |
| `NODE_ENV` | `production` no backend publicado. Em `test`, o transporte real fica bloqueado, mesmo se houver chave. |

Remetente fixo: **`SERVIRE <convites@send.servirepastoral.com.br>`**. Não depende de `EMAIL_FROM`. O domínio `send.servirepastoral.com.br` deve continuar verificado na conta Resend à qual a chave pertence. Não houve verificação remota ou alteração de DNS nesta tarefa.

Nenhuma variável é necessária no frontend/Nginx. Não colocar `RESEND_API_KEY` em `VITE_*`, build args, URLs, código ou Git. O serviço usa somente `https://api.resend.com`, independentemente de `RESEND_BASE_URL`; debug do SDK é explicitamente desativado mesmo que `RESEND_DEBUG=true` esteja no ambiente.

As antigas `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` e `EMAIL_FROM` **não são usadas para enviar convites neste fluxo**. Não foram apagadas ou modificadas. O serviço legado `emailService.js` e seus testes/diagnósticos SMTP permanecem disponíveis, sem fallback automático nem envio paralelo.

## Fluxo preservado

1. Os endpoints existentes de criação de administrador e reemissão de convite continuam protegidos por Superadministrador.
2. A transação serializável cria o administrador/convite ou invalida os convites anteriores e gera um novo. Tokens seguem com 256 bits de entropia, validade de **48 horas**, uso único e armazenamento apenas do SHA-256.
3. **Após o commit**, `entregarConvite` monta o HTML/texto e chama `resendEmailService.js`. A repetição transacional nunca executa o envio.
4. O SDK chama `resend.emails.send` com remetente fixo, destinatário, assunto, HTML e texto simples. O template existente mantém cores discretas do SERVIRE, nome quando disponível, paróquia, botão, link e explicação de validade/uso único. Dados dinâmicos do HTML são escapados.
5. Somente resposta sem erro e com ID não vazio é considerada aceita. O ID do provedor não é exposto ou registrado.
6. Falhas de rede, timeout ou rejeição do Resend não desfazem o cadastro nem invalidam indevidamente o convite confirmado.

O link usa `/aceitar-convite#token=...`, preservando a página existente e o comportamento do fragmento, que não é enviado como query ao servidor Nginx. Não há proxy nem alteração de rotas ou regras de aceitação.

## Status e cópia manual

| Status | Significado |
|---|---|
| `enviado` | Resend aceitou a mensagem; não garante entrega, ausência de spam ou leitura. |
| `nao_enviado` | Configuração inválida ou envio não confirmado. |
| `nao_configurado` | Chave ausente ou transporte bloqueado no ambiente de testes. |

Motivos controlados incluem `RESEND_AUSENTE`, `RESEND_INVALIDO`, `FALHA_RESEND`, `IDEMPOTENCIA_INVALIDA`, `DESTINATARIO_INVALIDO`, `AMBIENTE_TESTE` e `FRONTEND_URL_INVALIDA`. Nenhuma resposta bruta do provedor é devolvida.

Após sucesso, a resposta inclui somente `convite.expiraEm`, sem token ou link. Na falha/ausência de configuração, inclui o token e o link para entrega manual no diálogo existente. `Cache-Control: no-store` é preservado. O link não é persistido em texto puro, logs ou localStorage. Uma nova emissão invalida o anterior; copiar o link da operação falha evita nova emissão desnecessária.

Foram ajustadas somente duas expressões do diálogo do frontend: “servidor SMTP”/“confirmação do SMTP” passam a “serviço de e-mail”, pois o novo transporte é HTTPS. Layout, ações, contratos e autenticação do frontend não mudaram.

## Duplicação, timeout e limites

- Chave de idempotência: `convite-admin/` seguido do SHA-256 do token. Ela não contém o token em texto puro e não é registrada em logs. Convites diferentes recebem chaves diferentes.
- Chamadas simultâneas para o mesmo convite compartilham a tentativa em andamento na instância padrão do serviço. O registro é removido ao terminar, inclusive em falha; não é um cache permanente.
- A chave também é enviada ao Resend para proteção entre tentativas/processos. A janela de idempotência do provedor é **24 horas**, distinta das 48 horas de validade do convite. Não há garantia de entrega exatamente uma vez além dessa janela. Payload diferente com a mesma chave pode resultar em conflito 409. [Documentação oficial de idempotência](https://resend.com/docs/dashboard/emails/idempotency-keys).
- O SDK recebe `AbortSignal.timeout(15000)`. Sem retry automático da aplicação e **sem fallback SMTP**, evitando dois provedores enviarem após uma confirmação de rede perdida.
- Timeout pode ocorrer depois de o provedor aceitar a mensagem. O status local será não confirmado e o mesmo link poderá ser entregue manualmente. Não é uma prova de que nada saiu do Resend.
- Se o processo cair depois do commit e antes do envio/resposta, o operador precisará emitir novo convite. Não foi adicionada outbox, fila, coluna ou persistência do token em texto puro.
- Status de entrega/bounce não é persistido e não foram criados webhooks. É possível conferir a entrega pelo painel Resend com os cuidados de acesso apropriados.

## Logs seguros no Railway

Filtre o backend por `resend_falha`. Exemplos fictícios:

```json
{"evento":"resend_falha","codigo":"AUTORIZACAO","statusHttp":403}
{"evento":"resend_falha","codigo":"TIMEOUT"}
```

| Código | Investigação |
|---|---|
| `AUTORIZACAO` | HTTP 401/403: validade/permissões da chave e domínio de envio autorizado. O código sozinho não identifica qual condição foi recusada. |
| `LIMITE` | HTTP 429: limites do provedor. |
| `IDEMPOTENCIA` | HTTP 409: conflito de chave/payload ou pedido concorrente. |
| `PROVEDOR` | HTTP 5xx: falha do serviço remoto. |
| `REQUISICAO_RECUSADA` | Outro HTTP 4xx. |
| `TIMEOUT` | AbortSignal expirou durante o pedido. |
| `REDE_OU_RESPOSTA_INVALIDA` | Exceção de rede ou retorno sem confirmação reconhecida. |

Somente evento/código permitidos e status HTTP numérico entre 400 e 599 são registrados. Chave, headers, tokens, destinatários, assunto, conteúdo, link, IDs do provedor, mensagens, stacks e objetos de erro nunca são serializados pelo serviço. A ausência de configuração é retornada de forma controlada sem inicializar o SDK.

## Testes sem envio real

```bash
cd backend
npm ci
npm test
# Apenas se conferir também os dois textos do painel:
cd ../frontend
npm test
npm run lint
npm run build
```

`npm test` do backend força `NODE_ENV=test`. Os testes novos simulam o SDK Resend inteiro e usam chave fictícia; os testes legados de SMTP usam Nodemailer simulado. A suíte de integração existente também define `NODE_ENV=test`. Não são enviados nem mesmo e-mails para endereços de teste do provedor.

Validação do backend: **165 testes aprovados**, incluindo 13 novos testes Resend. Cobrem chave ausente/inválida, leitura exclusiva do ambiente, HTTPS/remetente, sucesso, recusa, exceção, timeout, logs sem segredos, deduplicação simultânea, chave estável e distinta por convite, domínio padrão/configurável, fallback manual, template e debug desativado. Os testes existentes de controller continuam confirmando commit antes de envio, repetição serializável sem duplicar a entrega e cadastro preservado em falha.

Também passaram **10 testes do frontend**, lint e build Vite após a correção dos dois textos do painel; permanece o aviso preexistente de bundle acima de 500 kB. Sintaxe dos arquivos JavaScript novos/alterados e `git diff --check` aprovados.

Não foi reexecutada integração com PostgreSQL: schema/migrations e regras de negócio não mudaram. Autenticação HTTPS real, entrega real e configuração de conta/domínio Resend permanecem para uma etapa autorizada.

## Publicação futura — após autorização

1. Revise o diff e execute a suíte. Confirme Node >=20 (o projeto usa 22), lockfile atualizado e permissão de envio da chave já presente no backend, sem imprimi-la.
2. Confirme `FRONTEND_URL=https://servirepastoral.com.br` e domínio de envio verificado. Nenhuma mudança dessas configurações foi executada por esta implementação.
3. Commit/push/deploy só com autorização. O backend mantém build `npm ci && npx prisma generate`, start `npm start` e seu pre-deploy existente. **Não há nova migration desta funcionalidade.**
4. Para o painel exibir texto neutro sobre o provedor, publique também a alteração textual do frontend em uma etapa autorizada, preservando a configuração Nginx. A API mantém compatibilidade com o frontend anterior, embora seus textos mencionem SMTP.
5. Após autorização explícita de envio real, use destinatário controlado e gere um único convite. Confira aceitação no painel, evento no Resend e link com domínio correto. Não faça testes de escrita indiscriminados no banco de produção.
6. Em falha, consulte códigos sanitizados e mantenha a entrega manual. Não habilite SMTP como fallback automático. Falta de configuração não derruba as outras funções do SERVIRE.

Nenhum comando Railway, alteração de variável, DNS/Cloudflare, autenticação, banco, migrations ou Nginx foi feito. Não houve commit, push, deploy ou e-mail real.

## Arquivos desta integração

Criados:

- `backend/src/services/resendEmailService.js`
- `backend/tests/resendEmail.test.js`

Modificados:

- `backend/package.json` e `backend/package-lock.json`: SDK oficial Resend.
- `backend/src/services/conviteEmailService.js`: provedor, origem padrão e idempotência; template reutilizado com saudação opcional.
- `frontend/src/pages/Superadmin.jsx`: somente dois textos que mencionavam SMTP.
- `docs/EMAIL_CONVITES.md`, `docs/SUPERADMIN.md` e `README.md`: documentação.

Referências: [SDK oficial](https://github.com/resend/resend-node), [envio Node.js](https://resend.com/docs/send-with-nodejs), [idempotência](https://resend.com/docs/dashboard/emails/idempotency-keys).
