# Alternativa Nginx para teste de RAM no Railway

Preparação local de uma alternativa opt-in para o frontend. **Nada foi publicado ou alterado no Railway.** O frontend atual continua com `npx --yes serve@14 -s dist -l tcp://0.0.0.0:$PORT`. Backend, PostgreSQL, autenticação, CORS, DNS e domínio oficial `https://servirepastoral.com.br` permanecem intactos. Serverless deve continuar desativado em ambos os serviços.

## Inspeção do projeto

- Frontend independente em `/frontend`, com seu próprio `package.json` e `package-lock.json`.
- Scripts existentes: `dev`, `build`, `lint`, `preview`, `test`. Não foram modificados.
- React Router usa `BrowserRouter`: `/login`, `/dashboard`, `/superadmin`, `/aceitar-convite`, `/meu-perfil`, `/pastorais`, `/pastorais/:pastoralId`, `/eventos`, `/eventos/:eventoId/escalas`, `/minhas-escalas` e `/usuarios`. Recarregar um deep link exige fallback para `index.html`.
- A única variável `VITE_*` utilizada pelo código é `VITE_API_URL`, em `src/services/api.js`. Em produção, sua ausência faz o cliente tentar a origem atual na porta 3333. Por isso, a alternativa Docker recusa o build se a variável não for uma URL HTTPS válida sem credenciais, query ou fragmento.
- `vite.config.js` usa React e Tailwind; sua configuração de porta 5173 é do servidor de desenvolvimento e não governa o Nginx.
- Não foram encontrados Dockerfile, railway.json/toml, nixpacks.toml ou Procfile versionados antes desta alteração. Configurações feitas pelo painel Railway não são verificáveis pelo repositório; precisam de conferência manual.
- Existe `.env` local no frontend. Seu conteúdo não foi lido nem copiado; arquivos `.env*` são excluídos do contexto Docker. Nenhuma variável existente foi alterada.

## Arquivos novos e comportamento

- `frontend/Dockerfile.nginx`: Node.js **22 Alpine** no build, `npm ci --include=dev` com lockfile e compilação Vite. Runtime **nginx:stable-alpine**, contendo somente o conteúdo compilado e a configuração Nginx. Node/npm/node_modules não são copiados para o estágio final.
- `frontend/Dockerfile.nginx.dockerignore`: exclusão específica desta alternativa para `.env*`, dependências e builds locais. Também há cópia explícita apenas dos arquivos necessários no Dockerfile.
- `frontend/nginx.conf`: configuração completa, um worker, `0.0.0.0:8080`, MIME types, fallback SPA, healthcheck `/healthz`, logs em stdout/stderr e access log sem query strings.
- Este documento.

**O nome é intencional:** o Railway detecta automaticamente um arquivo chamado exatamente `Dockerfile`. Usar `Dockerfile.nginx` exige seleção explícita no novo serviço e evita mudar automaticamente o builder do frontend atual quando esses arquivos forem futuramente versionados. Não renomeie para `Dockerfile` nesta comparação.

O HTML revalida com `Cache-Control: no-cache`. Arquivos com hash em `/assets/` recebem cache imutável de um ano. Arquivos públicos sem hash revalidam. Assets inexistentes e caminhos ocultos como `/.env` retornam 404, em vez de HTML da SPA. O bloco padrão `/etc/nginx/conf.d/default.conf` da imagem não é incluído pela configuração completa fornecida.

Não há proxy para a API, SSR, injeção de variável no runtime ou modificação dos módulos React. O Railway encerra HTTPS no proxy público; o container recebe HTTP na porta 8080.

## VITE_API_URL é uma configuração de build

Configure no **novo serviço apenas** o valor público já utilizado pelo frontend atual para a API, por exemplo a origem HTTPS pública do backend. O valor real não foi presumido neste documento. Não use o domínio do frontend como API, salvo se essa já for a arquitetura existente; esta alternativa não cria esse encaminhamento.

O Dockerfile declara `ARG VITE_API_URL` no estágio de build. A variável fica disponível ao `vite build` e é incorporada ao JavaScript. Alterá-la somente após o build não muda a imagem: é preciso recompilar.

Tudo que começa com `VITE_` pode ser exposto ao navegador. Não fornecer JWT_SECRET, DATABASE_URL, SMTP_PASS, senhas, chaves privadas ou tokens como build args/variáveis do frontend. O único build arg necessário é a URL pública da API. O estágio final não herda o ambiente Node do estágio de build.

## Validação executada localmente

- Node.js local: 22.22.1.
- `npm test --prefix frontend`: **10 testes aprovados**.
- `npm run lint --prefix frontend`: aprovado.
- `VITE_API_URL=https://api.example.invalid npm run build --prefix frontend`: aprovado. O endereço reservado é um valor fictício público apenas para verificar compilação; nenhum acesso à API é necessário ou foi feito pelo build.
- Permanece o aviso existente de bundle maior que 500 kB.
- `git diff --check`: aprovado.

**Limite importante:** Docker, Podman e Nginx não estão instalados no ambiente de desenvolvimento. Portanto, a imagem não foi construída/executada, `nginx -t` não foi executado e respostas HTTP/cabeçalhos do container ainda não foram verificadas. Testes React/build não substituem essas verificações. Não foi medida redução de RAM.

O build local gerou somente `dist/` ignorado pelo Git. Não foram alterados código funcional, package.json, lockfiles ou arquivos do backend.

## Validação do container em máquina com Docker

Estes comandos são instruções, **não foram executados**. A partir da raiz do repositório, substitua a URL fictícia pelo endereço público correto da API:

```bash
docker build \
  -f frontend/Dockerfile.nginx \
  --build-arg VITE_API_URL=https://api.example.invalid \
  -t servire-frontend-nginx:test \
  frontend

docker run --rm --entrypoint nginx servire-frontend-nginx:test -t

docker run --rm -d --name servire-nginx-test \
  -p 127.0.0.1:8081:8080 servire-frontend-nginx:test

curl -i http://127.0.0.1:8081/healthz
curl -I http://127.0.0.1:8081/
curl -I http://127.0.0.1:8081/login
curl -I http://127.0.0.1:8081/meu-perfil
curl -I http://127.0.0.1:8081/eventos/1/escalas
curl -I http://127.0.0.1:8081/aceitar-convite
curl -I http://127.0.0.1:8081/assets/inexistente.js
curl -I http://127.0.0.1:8081/.env

docker stats --no-stream servire-nginx-test
# Após a conferência local:
docker stop servire-nginx-test
```

Resultados esperados: healthcheck 200/texto `ok`, rotas SPA 200/text/html e revalidação do HTML; asset inexistente e `.env` 404. Confira também um JS/CSS real gerado em `/assets/`: 200, MIME correto e cache imutável. Confira uma imagem pública real e `/manifest.webmanifest`. Um 200 HTTP para rota protegida só entrega a SPA; não concede autorização na aplicação/API.

## Novo serviço de teste no Railway — somente após autorização

1. Primeiro valide o container acima. Para usar a fonte GitHub, os arquivos terão de ser commitados e enviados em uma branch **somente após autorização**. Não use a criação do serviço como pretexto para publicar automaticamente este trabalho.
2. No projeto existente, crie um **serviço novo**, por exemplo `frontend-nginx-teste`, usando o mesmo repositório SERVIRE e a branch que conterá estes arquivos. Prefira preparar um serviço vazio/configurado antes de conectar a fonte, para evitar um primeiro deploy com autodetecção incorreta. Não duplique indiscriminadamente configurações do backend ou do frontend oficial.
3. Nesse serviço novo, configure **Root Directory `/frontend`**. Os `COPY` são relativos a esse contexto e não funcionam com a raiz inteira do monorepo como contexto.
4. Defina **somente no novo serviço** `RAILWAY_DOCKERFILE_PATH=Dockerfile.nginx`. Não crie essa variável como compartilhada do projeto e não a aplique ao serviço oficial. A documentação trata o arquivo relativo à raiz da fonte selecionada; se o painel/log não localizar o arquivo, confira a raiz de build antes de tentar caminhos alternativos. O contexto esperado precisa conter package.json, src, public e nginx.conf diretamente.
5. Defina `VITE_API_URL` com a URL HTTPS pública correta do backend e `PORT=8080`, também somente no novo serviço. Não copie credenciais, variáveis SMTP ou conexão de banco.
6. Não configure build/start Node por cima do Dockerfile: deixe **Build Command**, **Start Command** e **Pre-deploy Command** sem overrides no novo serviço. O Dockerfile executa o build e seu `CMD` inicia o Nginx. Se o painel exigir seleção de builder, selecione Dockerfile e confira os logs; não prossiga se aparecer build Railpack/servidor `serve` no lugar da imagem proposta.
7. Mantenha **Serverless desativado**, uma réplica inicial e condições de região/limites comparáveis às do frontend atual. Configure healthcheck `/healthz`. Nenhum volume é necessário.
8. Gere exclusivamente um domínio temporário Railway para o serviço novo e confirme **target port 8080**. Não adicione, transfira ou remova `servirepastoral.com.br`; não altere DNS nem o domínio do serviço atual.
9. Revise as alterações pendentes antes do deploy: elas devem se limitar ao serviço novo. Publicação é uma ação futura dependente de autorização.
10. Após o deploy de teste autorizado, confira logs de build/runtime, `/healthz`, HTML, assets e deep links. Confirme que só o Nginx está servindo a imagem final. O comando do serviço oficial deve continuar exatamente `npx --yes serve@14 -s dist -l tcp://0.0.0.0:$PORT`.

Não foi adicionado railway.toml/json: assim não existe configuração versionada de deploy que possa atingir silenciosamente o serviço oficial.

## CORS e limite da comparação funcional

O domínio temporário do teste é uma **origem diferente** de `https://servirepastoral.com.br`. A API atual pode bloqueá-lo por CORS, mesmo com VITE_API_URL correta. Não foi lida nem alterada a lista de origens de produção.

Sem alterar CORS, é possível comparar RAM ociosa do servidor estático, carregar arquivos e verificar fallback SPA. Não se pode garantir login, notificações e navegação autenticada no domínio temporário. Uma comparação funcional completa exigirá uma origem já permitida ou um ambiente/backend de teste autorizado separadamente. Não usar proxy, desativação de segurança do navegador ou mudança de domínio oficial para contornar essa restrição. Não efetuar operações que alterem dados de produção durante o benchmark.

## Comparação de RAM e riscos

- Compare **a métrica do serviço frontend**, não o custo total do projeto. Backend e PostgreSQL não mudam.
- Mantenha Serverless desligado nos dois serviços, mesma quantidade de réplicas, região e limites comparáveis.
- Use janelas iguais após estabilização, separando build/startup de RAM residente. Registre média, mínimo e pico de RAM, CPU, requisições e reinícios. Repita as janelas; um único pico não caracteriza economia.
- Para teste ativo, use os mesmos caminhos, ritmo e condições de cache. O cache imutável pode reduzir requisições do navegador e confundir uma comparação sem controle.
- Node é usado somente no build desta alternativa; a hipótese é reduzir a RAM residente do servidor de arquivos. **Não existe percentual ou valor de economia comprovado ainda.**
- O serviço adicional gera custo enquanto estiver ativo. Seu encerramento após a comparação será uma ação manual autorizada, sem tocar no serviço oficial.
- `nginx:stable-alpine` e `node:22-alpine` são tags atualizáveis. Para reprodução exata entre medições, registre os digests usados e, numa revisão futura, fixe versões/digests aprovados.
- O comportamento de cabeçalhos/cache é explícito e pode diferir do `serve`; valide atualização de assets e recarga da SPA antes de qualquer substituição do serviço principal.

Referências oficiais consultadas: [Dockerfiles e build args no Railway](https://docs.railway.com/builds/dockerfiles), [Root Directory em monorepos](https://docs.railway.com/deployments/monorepo), [Start Command](https://docs.railway.com/deployments/start-command), [imagem oficial Nginx](https://hub.docker.com/_/nginx).
