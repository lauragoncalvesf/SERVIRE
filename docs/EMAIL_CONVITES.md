# Envio automático de convites — SERVIRE

Implementado na branch `feature/envio-email-convites`. Esta alteração não exige migrações e não modifica autenticação, permissões ou isolamento paroquial. Nenhuma configuração Railway foi alterada e nenhum e-mail real foi enviado durante o desenvolvimento.

## Configuração do backend

As configurações são lidas exclusivamente do ambiente do **backend**. Não coloque senhas em variáveis `VITE_*`, código, commits, links ou logs.

| Variável | Valor/finalidade |
|---|---|
| `SMTP_HOST` | Servidor SMTP; Gmail: `smtp.gmail.com` |
| `SMTP_PORT` | `465` para TLS implícito ou `587` para STARTTLS |
| `SMTP_SECURE` | Texto `true` na porta 465; texto `false` na 587. `false` continua exigindo TLS via STARTTLS |
| `SMTP_USER` | Usuário SMTP; neste projeto, `servirepastoral@gmail.com` |
| `SMTP_PASS` | Senha de aplicativo Gmail, mantida exclusivamente no ambiente seguro |
| `EMAIL_FROM` | Endereço remetente: `servirepastoral@gmail.com`. Também aceita formato `Nome <endereco>`; o nome exibido é sempre **SERVIRE — Sistema de Gestão Pastoral** |
| `FRONTEND_URL` | **Nova variável:** origem pública HTTPS do frontend, sem caminhos, query, fragmentos ou credenciais. Não usar endereço do backend, localhost ou endereços privados |

Nenhuma dessas variáveis foi criada ou modificada no Railway por esta implementação. As variáveis SMTP já existentes serão reutilizadas; confira `FRONTEND_URL` antes de uma futura publicação autorizada. Configuração ausente/inválida não derruba as demais funcionalidades do sistema.

O link enviado é `${FRONTEND_URL}/aceitar-convite#token=...`. O fragmento preserva o comportamento existente: o token não é enviado como query ao servidor do frontend nem como referer. A página de aceitação o remove da barra de endereço após abertura.

## Gmail

1. Na conta `servirepastoral@gmail.com`, habilite a verificação em duas etapas.
2. Gere uma senha de aplicativo específica para o SERVIRE, se a conta/política permitir, e armazene-a em `SMTP_PASS`. Não use a senha comum da conta. Senhas de aplicativo dependem de verificação em duas etapas; determinadas contas organizacionais ou com Proteção Avançada podem não disponibilizá-las. Veja a [documentação oficial do Google](https://support.google.com/accounts/answer/185833).
3. Confira host `smtp.gmail.com`, usuário e remetente. Escolha 465/`true` ou 587/`false`, conforme a configuração do serviço. Consulte [SMTP do Gmail](https://developers.google.com/workspace/gmail/imap/imap-smtp).
4. Após aprovação para publicação e envio real, valide a saída SMTP do ambiente Railway e faça um teste controlado com destinatário autorizado. Essa conexão **não foi testada com credenciais reais** nesta implementação.

Gmail pode limitar mensagens, bloquear autenticações ou direcionar convites para spam. A possibilidade de autenticar com senha de aplicativo depende das políticas da conta. Mudanças na senha da conta podem revogar senhas de aplicativo.

## Fluxo e tratamento de falhas

1. O backend cria o administrador e o convite de 48 horas, ou invalida convites anteriores e gera um novo, na transação serializável existente.
2. Somente depois do commit, tenta enviar **uma vez** com Nodemailer. Repetições da transação não disparam SMTP.
3. O e-mail inclui HTML responsivo com cores do SERVIRE, nome do administrador, paróquia, botão para definir senha, prazo e orientação para ignorar convites desconhecidos. Há também texto simples. Todos os dados dinâmicos do HTML são escapados.
4. A resposta mantém o código de sucesso do **cadastro/emissão**, mas separa o resultado do envio no campo `envio`. Falha SMTP não é apresentada como envio bem-sucedido e não remove o administrador nem desfaz o convite.

| `envio.status` | Significado na interface |
|---|---|
| `enviado` | O servidor SMTP aceitou o destinatário/mensagem; não garante leitura ou chegada à caixa de entrada |
| `nao_enviado` | Configuração inválida ou envio não confirmado; cadastro e convite preservados |
| `nao_configurado` | Configuração SMTP incompleta ou envio bloqueado no ambiente de teste |

`envio.motivo`, quando presente, contém somente um código controlado, como `SMTP_AUSENTE`, `SMTP_INVALIDO`, `FALHA_SMTP` ou `FRONTEND_URL_INVALIDA`; nunca mensagens brutas do provedor.

Após confirmação SMTP, `convite` contém somente `expiraEm`. Em falha/ausência de configuração, contém também `token` e, se a origem pública for válida, `link`. A interface mostra esse link somente no diálogo daquela operação, permitindo selecioná-lo e copiá-lo. Nada é gravado no localStorage, em logs ou em banco em texto puro. Somente o SHA-256 continua persistido no banco. As respostas permanecem com `Cache-Control: no-store`.

Sem `FRONTEND_URL` válida, nenhum e-mail é tentado. Para manter a entrega manual preexistente, a interface usa sua origem atual como alternativa e exibe aviso para conferir o endereço antes de compartilhar. O envio automático nunca usa essa origem ou um fallback para localhost.

## Segurança, tentativas e limites

- TLS mínimo 1.2, certificados validados. A porta 587 exige STARTTLS; 465 usa TLS desde o início. Não existe opção para desabilitar a validação do certificado.
- Timeouts: conexão e saudação de 10 segundos, socket inativo de 15 segundos. Logger/debug do Nodemailer desativados; acesso a arquivos/URLs externas para conteúdo bloqueado. Veja as [opções oficiais do Nodemailer](https://nodemailer.com/smtp).
- Sem `verify()` na inicialização, envios no startup, filas ou retries automáticos de SMTP. `Gerar convite` é uma ação explícita do operador e invalida o anterior.
- Em falhas ambíguas de rede, o SMTP pode ter aceitado a mensagem antes da desconexão. Não reenviamos automaticamente. Entregar o mesmo link manualmente evita gerar outro convite; uma nova emissão invalida o anterior.
- Não há garantia distribuída de entrega exatamente uma vez: se o processo parar após commit e antes de responder/enviar, será necessário gerar novo convite explicitamente. Essa escolha evita persistir o token em texto puro ou introduzir infraestrutura adicional.
- O status de envio é da operação e não é persistido como histórico de entrega. A auditoria administrativa e as regras de convite existentes permanecem intactas.
- Os botões continuam desabilitados durante a operação. Não há retry de POST configurado no cliente.

## Testes sem e-mails reais

```bash
cd backend
npm test
cd ../frontend
npm run build
npm run lint
```

Resultado desta alteração: **119 testes de backend aprovados**, incluindo 14 testes novos de configuração, TLS, sucesso, recusa/falha SMTP, link público, escape HTML, omissão de token, alternativa manual, ausência de logs, rollback/commit e repetição transacional sem duplicar o envio. Build e lint do frontend aprovados. O build mantém o aviso de bundle acima de 500 kB.

`npm test` força `NODE_ENV=test`. Os testes unitários usam transporte simulado e valores SMTP fictícios. O serviço também bloqueia transporte real com `NODE_ENV=test`, mesmo se houver credenciais no ambiente. A suíte de integração PostgreSQL preexistente já define esse modo. Nenhum comando de teste inicia um envio real ou acessa o SMTP configurado no `.env`.

A auditoria online `npm audit --json` apontou 12 alertas nas outras dependências existentes (3 moderados, 8 altos e 1 crítico, este em `proxy-addr`), sem alerta informado para Nodemailer 10.3.1. Não foram executados `npm audit fix` ou upgrades fora do escopo. Esses alertas precisam de revisão separada antes da publicação. A consulta offline não é evidência suficiente de ausência de vulnerabilidades.

A suíte PostgreSQL não foi reexecutada nesta alteração: não houve mudança no schema/migrações ou nas regras de consumo; a integração do controller com commit/retry foi coberta por mocks. Validação visual em navegador e autenticação SMTP/entrega real no Railway ficam para uma etapa explicitamente autorizada.

## Arquivos desta alteração

Criados:

- `backend/src/services/emailService.js`: serviço reutilizável de SMTP.
- `backend/src/services/conviteEmailService.js`: URL, modelo e resultado seguro da entrega.
- `backend/tests/email.test.js`: serviço/modelo/link e segurança.
- `backend/tests/conviteEmailController.test.js`: criação, reemissão e comportamento transacional.
- `docs/EMAIL_CONVITES.md`: configuração e operação.

Modificados:

- `backend/package.json` e `backend/package-lock.json`: dependência Nodemailer.
- `backend/src/controllers/superadminController.js`: envio após commit nos dois fluxos.
- `frontend/src/pages/Superadmin.jsx`: status e cópia manual condicional.
- `docs/SUPERADMIN.md` e `README.md`: documentação atualizada.

Não houve commit, push, deploy, migrações ou alterações de variáveis no Railway.
