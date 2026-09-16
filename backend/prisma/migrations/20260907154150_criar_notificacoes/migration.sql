-- CreateEnum
CREATE TYPE "TipoNotificacao" AS ENUM ('ESCALA_ABERTA', 'ESCALADO', 'SUBSTITUIDO', 'CONFIRMACAO_PENDENTE');

-- CreateTable
CREATE TABLE "Notificacao" (
    "id" SERIAL NOT NULL,
    "tipo" "TipoNotificacao" NOT NULL,
    "titulo" TEXT NOT NULL,
    "mensagem" TEXT NOT NULL,
    "lidaEm" TIMESTAMP(3),
    "usuarioId" INTEGER NOT NULL,
    "eventoId" INTEGER,
    "escalaId" INTEGER,
    "itemEscalaId" INTEGER,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notificacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notificacao_usuarioId_lidaEm_idx" ON "Notificacao"("usuarioId", "lidaEm");

-- CreateIndex
CREATE INDEX "Notificacao_eventoId_idx" ON "Notificacao"("eventoId");

-- CreateIndex
CREATE INDEX "Notificacao_escalaId_idx" ON "Notificacao"("escalaId");

-- AddForeignKey
ALTER TABLE "Notificacao" ADD CONSTRAINT "Notificacao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notificacao" ADD CONSTRAINT "Notificacao_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "Evento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notificacao" ADD CONSTRAINT "Notificacao_escalaId_fkey" FOREIGN KEY ("escalaId") REFERENCES "Escala"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notificacao" ADD CONSTRAINT "Notificacao_itemEscalaId_fkey" FOREIGN KEY ("itemEscalaId") REFERENCES "ItemEscala"("id") ON DELETE CASCADE ON UPDATE CASCADE;
