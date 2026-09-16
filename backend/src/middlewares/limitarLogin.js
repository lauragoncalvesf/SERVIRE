import { createHash } from "node:crypto"
import prisma from "../lib/prisma.js"

const MAX_TENTATIVAS = 10
const JANELA_MINUTOS = 15

function chave(valor) {
  return createHash("sha256").update(valor).digest("hex")
}

export async function limitarLogin(req, res, next) {
  try {
    const email = typeof req.body?.email === "string"
      ? req.body.email.trim().toLowerCase()
      : ""
    const paroquiaId = req.body?.paroquiaId
    const ip = req.ip || req.socket?.remoteAddress || "desconhecido"
    const chaves = [chave(`ip:${ip}`)]

    if (email && ["string", "number"].includes(typeof paroquiaId)) {
      chaves.push(chave(`conta:${paroquiaId}:${email}`))
    }

    for (const key of chaves) {
      const [registro] = await prisma.$queryRaw`
        INSERT INTO "LoginAttempt" ("key", "attempts", "expiresAt")
        VALUES (${key}, 1, NOW() + INTERVAL '15 minutes')
        ON CONFLICT ("key") DO UPDATE SET
          "attempts" = CASE
            WHEN "LoginAttempt"."expiresAt" <= NOW() THEN 1
            ELSE "LoginAttempt"."attempts" + 1
          END,
          "expiresAt" = CASE
            WHEN "LoginAttempt"."expiresAt" <= NOW()
              THEN NOW() + INTERVAL '15 minutes'
            ELSE "LoginAttempt"."expiresAt"
          END
        RETURNING "attempts", "expiresAt"
      `

      if (registro.attempts > MAX_TENTATIVAS) {
        const segundos = Math.max(1, Math.ceil((registro.expiresAt - Date.now()) / 1000))
        res.set("Retry-After", String(segundos))
        return res.status(429).json({
          mensagem: `Limite de ${MAX_TENTATIVAS} tentativas de login. Tente novamente em ${JANELA_MINUTOS} minutos.`
        })
      }
    }

    if (Math.random() < 0.01) {
      await prisma.$executeRaw`DELETE FROM "LoginAttempt" WHERE "expiresAt" < NOW()`
    }

    return next()
  } catch (error) {
    return next(error)
  }
}
