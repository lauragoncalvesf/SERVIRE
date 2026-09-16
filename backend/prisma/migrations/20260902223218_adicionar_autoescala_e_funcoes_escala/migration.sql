/*
  Warnings:

  - The values [PUBLICADA] on the enum `StatusEscala` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
ALTER TABLE "Escala"
ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "Escala"
ALTER COLUMN "status" TYPE TEXT
USING "status"::TEXT;

UPDATE "Escala"
SET "status" = 'ABERTA'
WHERE "status" = 'PUBLICADA';

DROP TYPE "StatusEscala";

CREATE TYPE "StatusEscala" AS ENUM (
    'RASCUNHO',
    'ABERTA',
    'PREENCHIDA',
    'COMPLETA',
    'ENCERRADA',
    'CANCELADA'
);

ALTER TABLE "Escala"
ALTER COLUMN "status" TYPE "StatusEscala"
USING "status"::"StatusEscala";

ALTER TABLE "Escala"
ALTER COLUMN "status" SET DEFAULT 'RASCUNHO';

-- AlterTable
ALTER TABLE "ItemEscala" ADD COLUMN     "funcaoEscalaId" INTEGER;

-- AlterTable
ALTER TABLE "Pastoral" ADD COLUMN     "exigeConfirmacao" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "permiteAutoEscala" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "FuncaoEscala" (
    "id" SERIAL NOT NULL,
    "quantidadeVagas" INTEGER NOT NULL DEFAULT 1,
    "escalaId" INTEGER NOT NULL,
    "funcaoPastoralId" INTEGER NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FuncaoEscala_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FuncaoEscala_escalaId_funcaoPastoralId_key" ON "FuncaoEscala"("escalaId", "funcaoPastoralId");

-- AddForeignKey
ALTER TABLE "ItemEscala" ADD CONSTRAINT "ItemEscala_funcaoEscalaId_fkey" FOREIGN KEY ("funcaoEscalaId") REFERENCES "FuncaoEscala"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuncaoEscala" ADD CONSTRAINT "FuncaoEscala_escalaId_fkey" FOREIGN KEY ("escalaId") REFERENCES "Escala"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuncaoEscala" ADD CONSTRAINT "FuncaoEscala_funcaoPastoralId_fkey" FOREIGN KEY ("funcaoPastoralId") REFERENCES "FuncaoPastoral"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
