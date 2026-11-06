import jwt from "jsonwebtoken"

export function assinarToken(usuario) {
  return jwt.sign({
    usuarioId: usuario.id,
    paroquiaId: usuario.paroquiaId,
    tipo: usuario.tipo,
    versaoSessao: usuario.versaoSessao ?? 0
  }, process.env.JWT_SECRET, { algorithm: "HS256", expiresIn: "7d" })
}
