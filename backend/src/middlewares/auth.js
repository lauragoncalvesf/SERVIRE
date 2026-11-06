import jwt from "jsonwebtoken"
import prisma from "../lib/prisma.js"

export async function auth(req, res, next) {
  const authorization = req.headers.authorization

  if (!authorization) {
    return res.status(401).json({ mensagem: "Token não informado" })
  }

  const bearer = typeof authorization === "string"
    ? /^Bearer ([^\s]+)$/i.exec(authorization)
    : null

  if (!bearer) {
    return res.status(401).json({ mensagem: "Token inválido" })
  }

  let payload

  try {
    payload = jwt.verify(bearer[1], process.env.JWT_SECRET, {
      algorithms: ["HS256"]
    })
  } catch {
    return res.status(401).json({ mensagem: "Token inválido ou expirado" })
  }

  if (
    !payload || typeof payload !== "object" ||
    !Number.isSafeInteger(payload.usuarioId) || payload.usuarioId < 1 ||
    (payload.paroquiaId !== null && (!Number.isSafeInteger(payload.paroquiaId) || payload.paroquiaId < 1)) ||
    !Number.isSafeInteger(payload.exp)
  ) {
    return res.status(401).json({ mensagem: "Token inválido" })
  }

  try {
    const usuario = await prisma.usuario.findFirst({
      where: {
        id: payload.usuarioId,
        paroquiaId: payload.paroquiaId,
        ativo: true,
        ...(payload.paroquiaId === null ? { tipo: "SUPER_ADMIN" } : { paroquia: { ativa: true } })
      },
      select: {
        id: true,
        paroquiaId: true,
        tipo: true,
        versaoSessao: true
      }
    })

    if (!usuario || (payload.versaoSessao ?? 0) !== (usuario.versaoSessao ?? 0)) {
      return res.status(401).json({ mensagem: "Usuário ou paróquia indisponível" })
    }

    req.usuarioId = usuario.id
    req.paroquiaId = usuario.paroquiaId
    req.tipoUsuario = usuario.tipo
    if (usuario.tipo === "SUPER_ADMIN" && !req.originalUrl?.startsWith("/superadmin/") && req.path !== "/auth/sessao") {
      return res.status(403).json({ mensagem: "Conta global sem acesso às operações paroquiais" })
    }
  } catch (error) {
    return next(error)
  }

  return next()
}
