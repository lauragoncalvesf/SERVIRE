import prisma from "../lib/prisma.js"

export async function criarPastoral(req, res, next) {
  try {
    const {
      nome,
      descricao,
      permiteAutoEscala = false,
      exigeConfirmacao = false
    } = req.body ?? {}

    const paroquiaId = req.paroquiaId

    if (typeof nome !== "string" || !nome.trim()) {
      return res.status(400).json({
        mensagem: "Nome e paroquiaId são obrigatórios"
      })
    }

    if (descricao != null && typeof descricao !== "string") {
      return res.status(400).json({ mensagem: "Descrição deve ser um texto" })
    }

    for (const [campo, valor] of Object.entries({ permiteAutoEscala, exigeConfirmacao })) {
      if (valor !== undefined && typeof valor !== "boolean") {
        return res.status(400).json({ mensagem: `${campo} deve ser true ou false` })
      }
    }

    const paroquia = await prisma.paroquia.findUnique({
      where: {
        id: Number(paroquiaId)
      }
    })

    if (!paroquia || !paroquia.ativa) {
      return res.status(404).json({
        mensagem: "Paróquia não encontrada"
      })
    }

    const pastoralExistente = await prisma.pastoral.findFirst({
      where: {
        nome: nome.trim(),
        paroquiaId: Number(paroquiaId)
      }
    })

    if (pastoralExistente) {
      return res.status(409).json({
        mensagem: "Já existe uma pastoral com este nome nesta paróquia"
      })
    }

    const pastoral = await prisma.pastoral.create({
      data: {
        nome: nome.trim(),
        descricao: descricao?.trim() || null,
        permiteAutoEscala,
        exigeConfirmacao,
        paroquiaId: req.paroquiaId
      }
    })

    return res.status(201).json(pastoral)
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({ mensagem: "Já existe uma pastoral com este nome nesta paróquia" })
    }

    return next(error)
  }
}

export async function listarPastorais(req, res, next) {
  try {
    const paroquiaId = req.paroquiaId

    const where = {
      paroquiaId: Number(paroquiaId),

      ...(req.tipoUsuario !== "ADMIN" && {
        membros: {
          some: {
            usuarioId: req.usuarioId,
            ativo: true
          }
        }
      })
    }

    const pastorais = await prisma.pastoral.findMany({
      where,

      include: {
        paroquia: {
          select: {
            id: true,
            nome: true
          }
        },

        _count: {
          select: {
            membros: {
              where: {
                ativo: true
              }
            }
          }
        }
      },

      orderBy: {
        nome: "asc"
      }
    })

    const coordenacoes =
      req.tipoUsuario === "ADMIN" ||
      pastorais.length === 0
        ? []
        : await prisma.membroPastoral.findMany({
            where: {
              usuarioId: req.usuarioId,

              pastoralId: {
                in: pastorais.map(
                  (pastoral) => pastoral.id
                )
              },

              ativo: true,
              papel: "COORDENADOR"
            },

            select: {
              pastoralId: true
            }
          })

    const pastoraisCoordenadas =
      new Set(
        coordenacoes.map(
          (vinculo) => vinculo.pastoralId
        )
      )

    const pastoraisComPermissao =
      pastorais.map((pastoral) => ({
        ...pastoral,

        podeGerenciar:
          req.tipoUsuario === "ADMIN" ||
          pastoraisCoordenadas.has(
            pastoral.id
          )
      }))

    return res.json(
      pastoraisComPermissao
    )

  } catch (error) {
    return next(error)
  }
}

export async function atualizarPastoral(req, res, next) {
  try {
    const pastoralId = Number(req.params.pastoralId)

    const {
      nome,
      descricao,
      permiteAutoEscala,
      exigeConfirmacao,
      ativa
    } = req.body ?? {}

    if (typeof nome !== "string" || !nome.trim()) {
      return res.status(400).json({
        mensagem: "Nome da pastoral é obrigatório"
      })
    }

    if (descricao != null && typeof descricao !== "string") {
      return res.status(400).json({ mensagem: "Descrição deve ser um texto" })
    }

    for (const [campo, valor] of Object.entries({ permiteAutoEscala, exigeConfirmacao, ativa })) {
      if (valor !== undefined && typeof valor !== "boolean") {
        return res.status(400).json({ mensagem: `${campo} deve ser true ou false` })
      }
    }

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

    const duplicada = await prisma.pastoral.findFirst({
      where: {
        paroquiaId: req.paroquiaId,
        nome: nome.trim(),
        id: {
          not: pastoralId
        }
      }
    })

    if (duplicada) {
      return res.status(409).json({
        mensagem: "Já existe uma pastoral com esse nome"
      })
    }

    const atualizada = await prisma.pastoral.update({
      where: {
        id: pastoralId
      },
      data: {
        nome: nome.trim(),
        ...(descricao !== undefined ? { descricao: descricao?.trim() || null } : {}),
        ...(permiteAutoEscala !== undefined ? { permiteAutoEscala } : {}),
        ...(exigeConfirmacao !== undefined ? { exigeConfirmacao } : {}),
        ...(ativa !== undefined ? { ativa } : {})
      }
    })

    return res.json(atualizada)

  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({ mensagem: "Já existe uma pastoral com este nome nesta paróquia" })
    }

    return next(error)
  }
}