import prisma from "../lib/prisma.js"

function idValido(valor) {
  if (typeof valor !== "string" && typeof valor !== "number") return false
  const id = Number(valor)
  return Number.isInteger(id) && id > 0 && id <= 2147483647
}

export async function adicionarMembroPastoral(req, res, next) {
  try {
    const {
      usuarioId,
      pastoralId,
      papel
    } = req.body ?? {}

    if (!idValido(usuarioId) || !idValido(pastoralId)) {
      return res.status(400).json({
        mensagem: "usuarioId e pastoralId devem ser IDs válidos"
      })
    }

    const papeisPermitidos = ["MEMBRO", "COORDENADOR"]
    
    const papelFinal = papel === undefined ? "MEMBRO" : papel

    if (!papeisPermitidos.includes(papelFinal)) {
      return res.status(400).json({
        mensagem: `Papel inválido. Os papéis permitidos são: ${papeisPermitidos.join(", ")}`
      })
    }

    const usuario = await prisma.usuario.findFirst({
      where: {
        id: Number(usuarioId),
        paroquiaId: req.paroquiaId,
        ativo: true
      }
    })

    if (!usuario) {
      return res.status(404).json({
        mensagem: "Usuário não encontrado"
      })
    }

    const pastoral = await prisma.pastoral.findFirst({
      where: {
        id: Number(pastoralId),
        paroquiaId: req.paroquiaId,
        ativa: true
      }
    })

    if (!pastoral) {
      return res.status(404).json({
        mensagem: "Pastoral não encontrada"
      })
    }

    const membroExistente = await prisma.membroPastoral.findUnique({
      where: {
        usuarioId_pastoralId: {
          usuarioId: Number(usuarioId),
          pastoralId: Number(pastoralId)
        }
      }
    })

    if (membroExistente) {
      return res.status(409).json({
        mensagem: "Este usuário já participa desta pastoral"
      })
    }

    const membro = await prisma.membroPastoral.create({
      data: {
        usuarioId: Number(usuarioId),
        pastoralId: Number(pastoralId),
        papel: papelFinal
      },
      include: {
        usuario: {
          select: {
            id: true,
            nome: true,
            email: true
          }
        },
        pastoral: {
          select: {
            id: true,
            nome: true
          }
        }
      }
    })

    return res.status(201).json(membro)
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({ mensagem: "Este usuário já participa desta pastoral" })
    }

    return next(error)
  }
}

export async function listarMembrosPastoral(req, res, next) {
  try {
    if (!idValido(req.params.pastoralId)) {
      return res.status(400).json({ mensagem: "pastoralId inválido" })
    }

    const pastoralId = Number(req.params.pastoralId)

    const pastoral = await prisma.pastoral.findFirst({
      where: {
        id: pastoralId,
        paroquiaId: req.paroquiaId
      }
    })

    if (!pastoral) {
      return res.status(404).json({
        mensagem: "Pastoral não encontrada"
      })
    }
    
    const membros = await prisma.membroPastoral.findMany({
      where: {
        pastoralId,
        ativo: true,
        usuario: { ativo: true, paroquiaId: req.paroquiaId }
      },
      include: {
        usuario: {
          select: {
            id: true,
            nome: true,
            email: true,
            telefone: true,
            tipo: true
          }
        }
      },
      orderBy: {
        usuario: {
          nome: "asc"
        }
      }
    })

    return res.json(membros)
  } catch (error) {
    return next(error)
  }
}

export async function atualizarMembroPastoral(req, res, next) {
  try {
    if (!idValido(req.params.membroPastoralId)) {
      return res.status(400).json({ mensagem: "membroPastoralId inválido" })
    }

    const membroPastoralId = Number(req.params.membroPastoralId)
    const { papel } = req.body ?? {}

    if (!["MEMBRO", "COORDENADOR"].includes(papel)) {
      return res.status(400).json({
        mensagem: "Papel inválido"
      })
    }

    const vinculo = await prisma.membroPastoral.findFirst({
      where: {
        id: membroPastoralId,
        pastoral: {
          paroquiaId: req.paroquiaId
        }
      },
      include: {
        usuario: {
          select: {
            id: true,
            nome: true
          }
        },
        pastoral: {
          select: {
            id: true,
            nome: true
          }
        }
      }
    })

    if (!vinculo) {
      return res.status(404).json({
        mensagem: "Membro da pastoral não encontrado"
      })
    }

    const atualizado = await prisma.membroPastoral.update({
      where: {
        id: membroPastoralId
      },
      data: {
        papel
      },
      include: {
        usuario: {
          select: {
            id: true,
            nome: true,
            email: true
          }
        },
        pastoral: {
          select: {
            id: true,
            nome: true
          }
        }
      }
    })

    return res.json(atualizado)

  } catch (error) {
    return next(error)
  }
}