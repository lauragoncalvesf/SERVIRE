import prisma from "../lib/prisma.js"

// IDs são Int no schema Prisma; rejeita coerções de booleanos e arrays do body.
function lerId(valor) {
  if (typeof valor !== "string" && typeof valor !== "number") return null
  const id = Number(valor)
  return Number.isInteger(id) && id > 0 && id <= 2147483647 ? id : null
}

async function verificarCoordenador(req, res, pastoralId) {
  if (req.tipoUsuario === "ADMIN") {
    return true
  }

  const vinculo = await prisma.membroPastoral.findUnique({
    where: {
      usuarioId_pastoralId: {
        usuarioId: req.usuarioId,
        pastoralId: Number(pastoralId)
      }
    }
  })

  if (
    !vinculo ||
    !vinculo.ativo ||
    vinculo.papel !== "COORDENADOR"
  ) {
    res.status(403).json({
      mensagem: "Você não é coordenador desta pastoral"
    })

    return false
  }

  return true
}


// Quando pastoralId vem diretamente do body
export function permitirCoordenadorPastoralBody() {
  return async (req, res, next) => {
    try {
      const pastoralId = lerId(req.body?.pastoralId)

      if (!pastoralId) {
        return res.status(400).json({
          mensagem: "pastoralId inválido"
        })
      }

      const pastoral = await prisma.pastoral.findFirst({
        where: { id: pastoralId, paroquiaId: req.paroquiaId },
        select: { id: true }
      })

      if (!pastoral) {
        return res.status(404).json({ mensagem: "Pastoral não encontrada" })
      }

      const permitido = await verificarCoordenador(
        req,
        res,
        pastoralId
      )

      if (!permitido) {
        return
      }

      next()

    } catch (error) {
      return next(error)
    }
  }
}


// Quando temos escalaId na URL
export function permitirCoordenadorPorEscala() {
  return async (req, res, next) => {
    try {
      const escalaId = lerId(req.params.escalaId)

      if (!escalaId) {
        return res.status(400).json({
          mensagem: "escalaId inválido"
        })
      }

      const escala = await prisma.escala.findFirst({
        where: {
          id: escalaId,
          pastoral: { paroquiaId: req.paroquiaId },
          evento: {
            paroquiaId: req.paroquiaId
          }
        },
        select: {
          id: true,
          pastoralId: true
        }
      })

      if (!escala) {
        return res.status(404).json({
          mensagem: "Escala não encontrada"
        })
      }

      const permitido = await verificarCoordenador(
        req,
        res,
        escala.pastoralId
      )

      if (!permitido) {
        return
      }

      next()

    } catch (error) {
      return next(error)
    }
  }
}


// A pastoral é obtida da função persistida, nunca do body da edição.
export function permitirCoordenadorPorFuncaoPastoral() {
  return async (req, res, next) => {
    try {
      const funcaoId = lerId(req.params.funcaoId)

      if (!funcaoId) {
        return res.status(400).json({ mensagem: "funcaoId inválido" })
      }

      const funcao = await prisma.funcaoPastoral.findFirst({
        where: {
          id: funcaoId,
          pastoral: { paroquiaId: req.paroquiaId }
        },
        select: { pastoralId: true }
      })

      if (!funcao) {
        return res.status(404).json({ mensagem: "Função da pastoral não encontrada" })
      }

      if (!await verificarCoordenador(req, res, funcao.pastoralId)) {
        return
      }

      return next()
    } catch (error) {
      return next(error)
    }
  }
}

export function permitirCoordenadorPorFuncaoEscala() {
  return async (req, res, next) => {
    try {
      const funcaoEscalaId = lerId(req.params.funcaoEscalaId)

      if (!funcaoEscalaId) {
        return res.status(400).json({ mensagem: "funcaoEscalaId inválido" })
      }

      const funcao = await prisma.funcaoEscala.findFirst({
        where: {
          id: funcaoEscalaId,
          escala: {
            evento: { paroquiaId: req.paroquiaId },
            pastoral: { paroquiaId: req.paroquiaId }
          }
        },
        select: {
          escala: { select: { pastoralId: true } }
        }
      })

      if (!funcao) {
        return res.status(404).json({ mensagem: "Função da escala não encontrada" })
      }

      if (!await verificarCoordenador(req, res, funcao.escala.pastoralId)) {
        return
      }

      return next()
    } catch (error) {
      return next(error)
    }
  }
}

// Quando temos itemId na URL
export function permitirCoordenadorPorItemEscala() {
  return async (req, res, next) => {
    try {
      const itemId = lerId(req.params.itemId)

      if (!itemId) {
        return res.status(400).json({
          mensagem: "itemId inválido"
        })
      }

      const item = await prisma.itemEscala.findFirst({
        where: {
          id: itemId,
          escala: {
            pastoral: { paroquiaId: req.paroquiaId },
            evento: { paroquiaId: req.paroquiaId }
          },
          evento: {
            paroquiaId: req.paroquiaId
          }
        },
        include: {
          escala: {
            select: {
              pastoralId: true
            }
          }
        }
      })

      if (!item) {
        return res.status(404).json({
          mensagem: "Item da escala não encontrado"
        })
      }

      const permitido = await verificarCoordenador(
        req,
        res,
        item.escala.pastoralId
      )

      if (!permitido) {
        return
      }

      next()

    } catch (error) {
      return next(error)
    }
  }
}

export function permitirCoordenadorPorMembroPastoral() {
  return async (req, res, next) => {
    try {
      const membroPastoralId = lerId(req.params.membroPastoralId)

      if (!membroPastoralId) {
        return res.status(400).json({ mensagem: "membroPastoralId inválido" })
      }

      const membro = await prisma.membroPastoral.findFirst({
        where: {
          id: membroPastoralId,
          pastoral: {
            paroquiaId: req.paroquiaId
          }
        },
        select: {
          pastoralId: true
        }
      })

      if (!membro) {
        return res.status(404).json({
          mensagem: "Membro da pastoral não encontrado"
        })
      }

      const permitido = await verificarCoordenador(
        req,
        res,
        membro.pastoralId
      )

      if (!permitido) {
        return
      }

      return next()

    } catch (error) {
      return next(error)
    }
  }
}

export function permitirCoordenadorPorPastoral() {
  return async (req, res, next) => {
    try {
      const pastoralId = lerId(req.params.pastoralId)

      if (!pastoralId) {
        return res.status(400).json({
          mensagem: "pastoralId inválido"
        })
      }

      const pastoral =
        await prisma.pastoral.findFirst({
          where: {
            id: pastoralId,
            paroquiaId: req.paroquiaId
          },
          select: {
            id: true
          }
        })

      if (!pastoral) {
        return res.status(404).json({
          mensagem: "Pastoral não encontrada"
        })
      }

      const permitido =
        await verificarCoordenador(
          req,
          res,
          pastoralId
        )

      if (!permitido) {
        return
      }

      next()

    } catch (error) {
      return next(error)
    }
  }
}
