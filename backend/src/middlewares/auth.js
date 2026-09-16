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
    !Number.isSafeInteger(payload.paroquiaId) || payload.paroquiaId < 1 ||
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
        paroquia: { ativa: true }
      },
      select: {
        id: true,
        paroquiaId: true,
        tipo: true
      }
    })

    if (!usuario) {
      return res.status(401).json({ mensagem: "Usuário ou paróquia indisponível" })
    }

    req.usuarioId = usuario.id
    req.paroquiaId = usuario.paroquiaId
    req.tipoUsuario = usuario.tipo
  } catch (error) {
    return next(error)
  }

  return next()
}
