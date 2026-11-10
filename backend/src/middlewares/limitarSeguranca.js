import prisma from "../lib/prisma.js"
import { consumirLimite } from "../services/limiteSegurancaService.js"

export function limitarSeguranca(escopo, maximo = 5) {
  return async (req, res, next) => {
    try {
      const ip = req.ip || req.socket?.remoteAddress || "desconhecido"
      if (!await consumirLimite(prisma, `ip:${escopo}:${ip}`, maximo, 900)) {
        res.set("Retry-After", "900")
        return res.status(429).json({ mensagem: "Muitas solicitações. Aguarde antes de tentar novamente." })
      }
      return next()
    } catch (erro) { return next(erro) }
  }
}
