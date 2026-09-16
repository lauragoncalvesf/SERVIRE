-- CreateEnum
CREATE TYPE "StatusEscala" AS ENUM ('RASCUNHO', 'PUBLICADA', 'ENCERRADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "StatusItemEscala" AS ENUM ('PENDENTE', 'CONFIRMADO', 'RECUSADO', 'SUBSTITUIDO');

-- CreateTable
CREATE TABLE "Escala" (
    "id" SERIAL NOT NULL,
    "status" "StatusEscala" NOT NULL DEFAULT 'RASCUNHO',
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "eventoId" INTEGER NOT NULL,
    "pastoralId" INTEGER NOT NULL,

    CONSTRAINT "Escala_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemEscala" (
    "id" SERIAL NOT NULL,
    "status" "StatusItemEscala" NOT NULL DEFAULT 'PENDENTE',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "escalaId" INTEGER NOT NULL,
    "eventoId" INTEGER NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "funcaoPastoralId" INTEGER NOT NULL,

    CONSTRAINT "ItemEscala_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Escala_eventoId_pastoralId_key" ON "Escala"("eventoId", "pastoralId");

-- CreateIndex
CREATE UNIQUE INDEX "ItemEscala_eventoId_usuarioId_key" ON "ItemEscala"("eventoId", "usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "ItemEscala_escalaId_funcaoPastoralId_key" ON "ItemEscala"("escalaId", "funcaoPastoralId");

-- AddForeignKey
ALTER TABLE "Escala" ADD CONSTRAINT "Escala_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "Evento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Escala" ADD CONSTRAINT "Escala_pastoralId_fkey" FOREIGN KEY ("pastoralId") REFERENCES "Pastoral"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemEscala" ADD CONSTRAINT "ItemEscala_escalaId_fkey" FOREIGN KEY ("escalaId") REFERENCES "Escala"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemEscala" ADD CONSTRAINT "ItemEscala_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "Evento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemEscala" ADD CONSTRAINT "ItemEscala_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemEscala" ADD CONSTRAINT "ItemEscala_funcaoPastoralId_fkey" FOREIGN KEY ("funcaoPastoralId") REFERENCES "FuncaoPastoral"("id") ON DELETE CASCADE ON UPDATE CASCADE;
