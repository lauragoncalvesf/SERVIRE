# ⛪ Servire — Sistema de Gestão Pastoral

O **Servire** é um sistema de gestão pastoral desenvolvido para auxiliar na organização das atividades de uma paróquia, especialmente no gerenciamento de **pastorais, membros, funções, eventos e escalas**.

O projeto surgiu da necessidade de tornar a criação e o acompanhamento das escalas mais simples, centralizados e organizados, reduzindo conflitos entre os membros que participam das atividades da paróquia.

## 🎯 Objetivo

Centralizar a organização das pastorais e facilitar a criação das escalas dos membros para missas, celebrações e outros eventos.

Uma das principais regras do sistema é impedir conflitos de escala, considerando que um membro pode participar de **várias pastorais**, mas não deve assumir mais de uma função no mesmo período.

## ✨ Funcionalidades

O sistema conta atualmente com funcionalidades para:

- Autenticação de usuários;
- Gerenciamento da paróquia;
- Cadastro e gerenciamento de pastorais;
- Cadastro de membros nas pastorais;
- Definição de funções de cada pastoral;
- Cadastro e gerenciamento de eventos;
- Criação e gerenciamento de escalas;
- Adição de membros às escalas;
- Controle de indisponibilidades;
- Confirmação ou recusa de participação em uma escala;
- Controle de acesso utilizando autenticação JWT;
- Separação dos dados de acordo com a paróquia do usuário.

## 📋 Escalas Pastorais

Cada pastoral pode possuir suas próprias funções.

Por exemplo:

**Liturgia**
- 1ª Leitura
- 2ª Leitura
- Salmo

**PASCOM**
- Transmissão
- Cobertura
- Fotografia

Ao criar uma escala, o sistema relaciona o evento, a pastoral, as funções necessárias e os membros responsáveis.

O membro escalado poderá posteriormente **confirmar ou recusar sua participação**.

## 🏗️ Estrutura do Sistema

O projeto está dividido em duas aplicações principais:

```text
sistema-paroquia/
│
├── backend/
│   ├── prisma/
│   ├── src/
│   │   ├── controllers/
│   │   ├── middlewares/
│   │   ├── routes/
│   │   └── lib/
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   └── services/
│   └── package.json
│
└── README.md
```

## 🛠️ Tecnologias

### Front-end

- React
- Vite
- Tailwind CSS
- JavaScript

### Back-end

- Node.js
- Express
- Prisma ORM
- PostgreSQL

### Autenticação

- JWT — JSON Web Token

## 🗄️ Banco de Dados

O sistema utiliza **PostgreSQL** com **Prisma ORM** para gerenciamento e acesso aos dados.

Entre as principais entidades do sistema estão:

- `Paroquia`
- `Usuario`
- `Pastoral`
- `MembroPastoral`
- `FuncaoPastoral`
- `Evento`
- `Escala`
- `ItemEscala`
- `Indisponibilidade`

### Relacionamentos principais

Uma paróquia pode possuir diversos usuários, pastorais e eventos.

Um usuário pode participar de várias pastorais através de `MembroPastoral`.

Cada pastoral pode possuir diversas funções através de `FuncaoPastoral`.

As escalas são relacionadas aos eventos e possuem itens que determinam quais membros exercerão determinadas funções.

## 🔐 Autenticação e Segurança

O Servire utiliza autenticação baseada em **JWT**.

Após realizar o login, o token identifica informações importantes do usuário, permitindo que o backend controle o acesso às funcionalidades e aos dados correspondentes à sua paróquia.

As rotas protegidas utilizam middleware de autenticação antes de permitir o acesso aos recursos do sistema.

## 🔄 Fluxo básico

```text
Usuário
   ↓
Login
   ↓
Dashboard
   ↓
Pastorais
   ↓
Eventos
   ↓
Escalas
   ↓
Membros + Funções
   ↓
Confirmação ou Recusa
```

## 🚀 Executando o projeto

### 1. Clone o repositório

```bash
git clone URL_DO_REPOSITORIO
cd sistema-paroquia
```

### 2. Configure o Backend

Entre na pasta:

```bash
cd backend
```

Instale as dependências:

```bash
npm install
```

Configure o arquivo `.env`:

```env
DATABASE_URL="postgresql://usuario:senha@localhost:5432/servire"
JWT_SECRET="sua_chave_secreta"
```

Execute as configurações do Prisma:

```bash
npx prisma generate
npx prisma migrate dev
```

Inicie o servidor:

```bash
npm run dev
```

A API será executada, por padrão, na porta:

```text
http://localhost:3333
```

### 3. Configure o Front-end

Em outro terminal:

```bash
cd frontend
npm install
npm run dev
```

O Vite exibirá no terminal o endereço utilizado para acessar a aplicação.

## 📌 Requisitos

Para executar o projeto localmente é necessário possuir:

- Node.js
- npm
- PostgreSQL
- Git

## 🌱 Status do Projeto

🚧 **Em desenvolvimento**

O Servire continua recebendo novas funcionalidades e melhorias conforme as necessidades de gestão pastoral são analisadas e implementadas.

## 💡 Motivação

A organização de escalas pastorais normalmente envolve diferentes pessoas, funções, horários e eventos.

O Servire busca centralizar essas informações em uma única plataforma, tornando o processo de organização mais simples e reduzindo problemas como conflitos de horários, dificuldade de comunicação e falta de acompanhamento das escalas.

## 👩‍💻 Desenvolvimento

Desenvolvido por **Laura Gonçalves**.

Projeto desenvolvido com foco na aplicação prática de conceitos de desenvolvimento web, APIs REST, bancos de dados relacionais, autenticação e modelagem de sistemas.
