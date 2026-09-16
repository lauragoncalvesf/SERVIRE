-- CreateEnum
CREATE TYPE "TipoEvento" AS ENUM ('MISSA', 'CELEBRACAO', 'ADORACAO', 'NOVENA', 'PROCISSAO', 'REUNIAO', 'OUTRO');

-- CreateTable
CREATE TABLE "Evento" (
    "id" SERIAL NOT NULL,
    "titulo" TEXT NOT NULL,
    "tipo" "TipoEvento" NOT NULL DEFAULT 'MISSA',
    "dataHora" TIMESTAMP(3) NOT NULL,
    "local" TEXT,
    "descricao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "paroquiaId" INTEGER NOT NULL,

    CONSTRAINT "Evento_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Evento" ADD CONSTRAINT "Evento_paroquiaId_fkey" FOREIGN KEY ("paroquiaId") REFERENCES "Paroquia"("id") ON DELETE CASCADE ON UPDATE CASCADE;
