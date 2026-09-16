import prisma from "../lib/prisma.js"

export async function criarEvento(req, res) {
  try {
    const {
      titulo,
      tipo,
      dataHora,
      local,
      descricao
    } = req.body

    const tiposPermitidos = [
      "MISSA",
      "CELEBRACAO",
      "ADORACAO",
      "NOVENA",
      "PROCISSAO",
      "REUNIAO",
      "OUTRO"
    ]

    if (
      tipo !== undefined &&
      !tiposPermitidos.includes(tipo)
    ) {
      return res.status(400).json({
        mensagem: "Tipo de evento inválido"
      })
    }

    const paroquiaId = req.paroquiaId

    const ehAdmin =
      req.tipoUsuario === "ADMIN"

    let ehCoordenadorPastoral = false

    if (!ehAdmin) {
      const coordenacao =
        await prisma.membroPastoral.findFirst({
          where: {
            usuarioId: req.usuarioId,
            ativo: true,
            papel: "COORDENADOR",
            pastoral: {
              paroquiaId: req.paroquiaId,
              ativa: true
            }
          }
        })

      ehCoordenadorPastoral =
        Boolean(coordenacao)
    }

    if (
      !ehAdmin &&
      !ehCoordenadorPastoral
    ) {
      return res.status(403).json({
        mensagem:
          "Você não possui permissão para criar eventos"
      })
    }

    if (!titulo || !dataHora) {
      return res.status(400).json({
        mensagem: "Título, dataHora e paroquiaId são obrigatórios"
      })
    }

    const dataEvento = new Date(dataHora)

    if (isNaN(dataEvento.getTime())) {
      return res.status(400).json({
        mensagem: "Data e horário inválidos"
      })
    }
    
    const evento = await prisma.evento.create({
      data: {
        titulo,
        tipo: tipo || "MISSA",
        dataHora: dataEvento,
        local,
        descricao,
        paroquiaId
      }
    })

    return res.status(201).json(evento)
    } catch (error) {
    console.error(error)

    return res.status(500).json({
      mensagem: "Erro ao criar evento"
    })
  }
}

export async function listarEventos(req, res) {
  try {
    const paroquiaId = req.paroquiaId

    const eventos = await prisma.evento.findMany({
      where: {
        paroquiaId: req.paroquiaId,
        ativo: true
      },
      orderBy: {
        dataHora: "asc"
      }
    })

    return res.json(eventos)

  } catch (error) {
    console.error(error)

    return res.status(500).json({
      mensagem: "Erro ao listar eventos"
    })
  }
}