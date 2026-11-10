-- Aditiva: endereços existentes permanecem NÃO autorizados e NÃO confirmados.
ALTER TABLE "Usuario" ADD COLUMN "emailAutorizadoEm" TIMESTAMP(3),
 ADD COLUMN "emailAutorizadoPor" INTEGER, ADD COLUMN "emailConfirmadoEm" TIMESTAMP(3);
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_confirmacao_exige_autorizacao"
 CHECK (("emailAutorizadoEm" IS NULL) = ("emailAutorizadoPor" IS NULL)
 AND ("emailConfirmadoEm" IS NULL OR "emailAutorizadoEm" IS NOT NULL));
CREATE TYPE "FinalidadeTokenSeguranca" AS ENUM ('CONFIRMAR_EMAIL', 'RECUPERAR_SENHA');
CREATE TABLE "TokenSeguranca" (
 "id" SERIAL PRIMARY KEY, "tokenHash" TEXT NOT NULL UNIQUE,
 "usuarioId" INTEGER NOT NULL REFERENCES "Usuario"("id") ON DELETE CASCADE,
 "finalidade" "FinalidadeTokenSeguranca" NOT NULL, "emailHash" TEXT NOT NULL,
 "versaoSessao" INTEGER NOT NULL, "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "expiraEm" TIMESTAMP(3) NOT NULL, "consumidoEm" TIMESTAMP(3),
 CONSTRAINT "TokenSeguranca_prazo" CHECK ("expiraEm" > "criadoEm")
);
CREATE INDEX "TokenSeguranca_usuarioId_finalidade_consumidoEm_idx" ON "TokenSeguranca"("usuarioId", "finalidade", "consumidoEm");
CREATE INDEX "TokenSeguranca_expiraEm_idx" ON "TokenSeguranca"("expiraEm");
-- Protege TODAS as rotas existentes de atualização, inclusive alterações administrativas.
CREATE FUNCTION servire_invalidar_seguranca_usuario() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF lower(btrim(NEW."email")) IS DISTINCT FROM lower(btrim(OLD."email")) THEN
  NEW."emailAutorizadoEm" := NULL;
  NEW."emailAutorizadoPor" := NULL;
  NEW."emailConfirmadoEm" := NULL;
  NEW."versaoSessao" := GREATEST(NEW."versaoSessao", OLD."versaoSessao" + 1);
 END IF;
 IF NEW."versaoSessao" IS DISTINCT FROM OLD."versaoSessao"
 OR NEW."senha" IS DISTINCT FROM OLD."senha"
 OR NEW."ativo" IS DISTINCT FROM OLD."ativo"
 OR NEW."tipo" IS DISTINCT FROM OLD."tipo"
 OR NEW."paroquiaId" IS DISTINCT FROM OLD."paroquiaId" THEN
  UPDATE "TokenSeguranca" SET "consumidoEm" = CURRENT_TIMESTAMP
   WHERE "usuarioId" = OLD."id" AND "consumidoEm" IS NULL;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER "Usuario_invalidar_seguranca" BEFORE UPDATE ON "Usuario"
 FOR EACH ROW EXECUTE FUNCTION servire_invalidar_seguranca_usuario();
