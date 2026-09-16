export function permitirTipo(...tiposPermitidos) {
  return (req, res, next) => {
    if (!req.tipoUsuario) {
      return res.status(401).json({
        mensagem: "Usuário não autenticado"
      })
    }

    if (!tiposPermitidos.includes(req.tipoUsuario)) {
      return res.status(403).json({
        mensagem: "Você não possui permissão para acessar esta rota"
      })
    }

    next()
  }
}