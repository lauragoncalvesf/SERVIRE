-- CreateTable
CREATE TABLE "FuncaoPastoral" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "pastoralId" INTEGER NOT NULL,

    CONSTRAINT "FuncaoPastoral_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FuncaoPastoral_pastoralId_nome_key" ON "FuncaoPastoral"("pastoralId", "nome");

-- AddForeignKey
ALTER TABLE "FuncaoPastoral" ADD CONSTRAINT "FuncaoPastoral_pastoralId_fkey" FOREIGN KEY ("pastoralId") REFERENCES "Pastoral"("id") ON DELETE CASCADE ON UPDATE CASCADE;
