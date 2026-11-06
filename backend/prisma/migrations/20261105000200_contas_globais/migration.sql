ALTER TABLE "Usuario" ALTER COLUMN "paroquiaId" DROP NOT NULL;
ALTER TABLE "Usuario" ADD COLUMN "versaoSessao" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_vinculo_paroquial" CHECK (("tipo" = 'SUPER_ADMIN' AND "paroquiaId" IS NULL) OR ("tipo" <> 'SUPER_ADMIN' AND "paroquiaId" IS NOT NULL));
CREATE UNIQUE INDEX "Usuario_email_global_unique" ON "Usuario" (lower("email")) WHERE "paroquiaId" IS NULL;
CREATE TABLE "ConviteAdmin" (
 "id" SERIAL PRIMARY KEY, "tokenHash" TEXT NOT NULL UNIQUE, "usuarioId" INTEGER NOT NULL REFERENCES "Usuario"("id") ON DELETE CASCADE,
 "expiraEm" TIMESTAMP(3) NOT NULL, "consumidoEm" TIMESTAMP(3), "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "AuditoriaAdmin" (
 "id" SERIAL PRIMARY KEY, "autorId" INTEGER NOT NULL, "acao" TEXT NOT NULL, "recurso" TEXT NOT NULL, "recursoId" INTEGER NOT NULL,
 "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
