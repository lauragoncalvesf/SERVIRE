import prisma from "../lib/prisma.js"

const tiposPermitidos = [
  "MISSA",
  "CELEBRACAO",
  "ADORACAO",
  "NOVENA",
  "PROCISSAO",
  "REUNIAO",
  "OUTRO"
]

export async function criarEvento(req, res) {
  try {
    const {
      titulo,
      tipo,
      dataHora,
      local,
      descricao
    } = req.body

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

export async function atualizarEvento(req, res) {
  try {
    const eventoId = Number(req.params.eventoId)
    const { titulo, tipo, dataHora, local, descricao } = req.body ?? {}

    if (!Number.isSafeInteger(eventoId) || eventoId < 1) {
      return res.status(400).json({ mensagem: "Evento inválido" })
    }

    if (typeof titulo !== "string" || !titulo.trim() || !dataHora) {
      return res.status(400).json({ mensagem: "Título e dataHora são obrigatórios" })
    }

    if (!tiposPermitidos.includes(tipo)) {
      return res.status(400).json({ mensagem: "Tipo de evento inválido" })
    }

    if (
      (local !== undefined && local !== null && typeof local !== "string") ||
      (descricao !== undefined && descricao !== null && typeof descricao !== "string")
    ) {
      return res.status(400).json({ mensagem: "Dados do evento inválidos" })
    }

    const dataEvento = new Date(dataHora)

    if (Number.isNaN(dataEvento.getTime())) {
      return res.status(400).json({ mensagem: "Data e horário inválidos" })
    }

    const existente = await prisma.evento.findFirst({
      where: { id: eventoId, paroquiaId: req.paroquiaId, ativo: true },
      select: { id: true }
    })

    if (!existente) {
      return res.status(404).json({ mensagem: "Evento não encontrado" })
    }

    const evento = await prisma.evento.update({
      where: { id: eventoId },
      data: {
        titulo: titulo.trim(),
        tipo,
        dataHora: dataEvento,
        local: local?.trim() || null,
        descricao: descricao?.trim() || null
      }
    })

    return res.json(evento)
  } catch (error) {
    console.error(error)
    return res.status(500).json({ mensagem: "Erro ao atualizar evento" })
  }
}

export async function cancelarEvento(req, res) {
  try {
    const eventoId = Number(req.params.eventoId)

    if (!Number.isSafeInteger(eventoId) || eventoId < 1) {
      return res.status(400).json({ mensagem: "Evento inválido" })
    }

    const existente = await prisma.evento.findFirst({
      where: { id: eventoId, paroquiaId: req.paroquiaId, ativo: true },
      select: { id: true }
    })

    if (!existente) {
      return res.status(404).json({ mensagem: "Evento não encontrado" })
    }

    await prisma.evento.update({
      where: { id: eventoId },
      data: { ativo: false }
    })

    return res.json({ mensagem: "Evento cancelado com sucesso" })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ mensagem: "Erro ao cancelar evento" })
  }
}
