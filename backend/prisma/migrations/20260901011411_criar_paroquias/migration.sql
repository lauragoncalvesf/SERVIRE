-- CreateEnum
CREATE TYPE "TipoUsuario" AS ENUM ('ADMIN', 'COORDENADOR', 'MEMBRO');

-- CreateEnum
CREATE TYPE "PapelMembroPastoral" AS ENUM ('COORDENADOR', 'MEMBRO');

-- CreateTable
CREATE TABLE "Paroquia" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "cidade" TEXT,
    "estado" TEXT,
    "telefone" TEXT,
    "email" TEXT,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Paroquia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senha" TEXT NOT NULL,
    "telefone" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "tipo" "TipoUsuario" NOT NULL DEFAULT 'MEMBRO',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "paroquiaId" INTEGER NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pastoral" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "paroquiaId" INTEGER NOT NULL,

    CONSTRAINT "Pastoral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembroPastoral" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "pastoralId" INTEGER NOT NULL,
    "papel" "PapelMembroPastoral" NOT NULL DEFAULT 'MEMBRO',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MembroPastoral_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_paroquiaId_email_key" ON "Usuario"("paroquiaId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "Pastoral_paroquiaId_nome_key" ON "Pastoral"("paroquiaId", "nome");

-- CreateIndex
CREATE UNIQUE INDEX "MembroPastoral_usuarioId_pastoralId_key" ON "MembroPastoral"("usuarioId", "pastoralId");

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_paroquiaId_fkey" FOREIGN KEY ("paroquiaId") REFERENCES "Paroquia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pastoral" ADD CONSTRAINT "Pastoral_paroquiaId_fkey" FOREIGN KEY ("paroquiaId") REFERENCES "Paroquia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembroPastoral" ADD CONSTRAINT "MembroPastoral_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembroPastoral" ADD CONSTRAINT "MembroPastoral_pastoralId_fkey" FOREIGN KEY ("pastoralId") REFERENCES "Pastoral"("id") ON DELETE CASCADE ON UPDATE CASCADE;
