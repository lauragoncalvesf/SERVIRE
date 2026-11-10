import { createHash } from "node:crypto"

export const hashSeguranca = valor => createHash("sha256").update(valor).digest("hex")
export async function consumirLimite(banco, identificador, maximo, segundos) {
  const key = hashSeguranca(`seguranca:${identificador}`)
  const [registro] = await banco.$queryRaw`
    INSERT INTO "LoginAttempt" ("key", "attempts", "expiresAt")
    VALUES (${key}, 1, NOW() + ${segundos} * INTERVAL '1 second')
    ON CONFLICT ("key") DO UPDATE SET
      "attempts" = CASE WHEN "LoginAttempt"."expiresAt" <= NOW() THEN 1 ELSE "LoginAttempt"."attempts" + 1 END,
      "expiresAt" = CASE WHEN "LoginAttempt"."expiresAt" <= NOW() THEN NOW() + ${segundos} * INTERVAL '1 second' ELSE "LoginAttempt"."expiresAt" END
    RETURNING "attempts"
  `
  return registro.attempts <= maximo
}
