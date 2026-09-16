/*
  Warnings:

  - The values [COORDENADOR] on the enum `TipoUsuario` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "TipoUsuario_new" AS ENUM ('ADMIN', 'MEMBRO');
ALTER TABLE "public"."Usuario" ALTER COLUMN "tipo" DROP DEFAULT;
ALTER TABLE "Usuario" ALTER COLUMN "tipo" TYPE "TipoUsuario_new" USING ("tipo"::text::"TipoUsuario_new");
ALTER TYPE "TipoUsuario" RENAME TO "TipoUsuario_old";
ALTER TYPE "TipoUsuario_new" RENAME TO "TipoUsuario";
DROP TYPE "public"."TipoUsuario_old";
ALTER TABLE "Usuario" ALTER COLUMN "tipo" SET DEFAULT 'MEMBRO';
COMMIT;
