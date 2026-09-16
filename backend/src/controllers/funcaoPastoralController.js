import prisma from "../lib/prisma.js"

function idValido(valor) {
  if (typeof valor !== "string" && typeof valor !== "number") return false
  const id = Number(valor)
  return Number.isInteger(id) && id > 0 && id <= 2147483647
}

export async function criarFuncaoPastoral(req, res, next) {
  try {
    const {
      nome,
      descricao,
      pastoralId
    } = req.body ?? {}

    if (typeof nome !== "string" || !nome.trim() || !idValido(pastoralId)) {
      return res.status(400).json({
        mensagem: "Nome e pastoralId válidos são obrigatórios"
      })
    }

    if (descricao != null && typeof descricao !== "string") {
      return res.status(400).json({ mensagem: "Descrição deve ser um texto" })
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

    const existente = await prisma.funcaoPastoral.findFirst({
      where: {
        nome: nome.trim(),
        pastoralId: Number(pastoralId)
      }
    })

    if (existente) {
      return res.status(409).json({
        mensagem: "Esta função já existe nesta pastoral"
      })
    }

    const funcao = await prisma.funcaoPastoral.create({
      data: {
        nome: nome.trim(),
        descricao: descricao?.trim() || null,
        pastoralId: Number(pastoralId)
      }
    })

    return res.status(201).json(funcao)
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({ mensagem: "Já existe uma função com esse nome nesta pastoral" })
    }

    return next(error)
  }
}

export async function listarFuncoesPastoral(req, res, next) {
  try {
    if (!idValido(req.params.pastoralId)) {
      return res.status(400).json({ mensagem: "pastoralId inválido" })
    }

    const pastoralId = Number(req.params.pastoralId)

    const pastoral = await prisma.pastoral.findFirst({
      where: {
        id: pastoralId,
        paroquiaId: req.paroquiaId,
        ativa: true
      }
    })

    if (!pastoral) {
      return res.status(404).json({
        mensagem: "Pastoral não encontrada"
      })
    }

    const funcoes = await prisma.funcaoPastoral.findMany({
      where: {
        pastoralId,
        ativa: true
      },
      orderBy: {
        nome: "asc"
      }
    })

    return res.json(funcoes)
  } catch (error) {
    return next(error)
  }
}

export async function atualizarFuncaoPastoral(req, res, next) {
  try {
    if (!idValido(req.params.funcaoId)) {
      return res.status(400).json({ mensagem: "funcaoId inválido" })
    }

    const funcaoId = Number(req.params.funcaoId)
    const { nome, descricao } = req.body ?? {}

    if (typeof nome !== "string" || !nome.trim()) {
      return res.status(400).json({
        mensagem: "Nome da função é obrigatório"
      })
    }

    if (descricao != null && typeof descricao !== "string") {
      return res.status(400).json({ mensagem: "Descrição deve ser um texto" })
    }

    const funcao = await prisma.funcaoPastoral.findFirst({
      where: {
        id: funcaoId,
        pastoral: {
          paroquiaId: req.paroquiaId
        }
      }
    })

    if (!funcao) {
      return res.status(404).json({
        mensagem: "Função não encontrada"
      })
    }

    const duplicada = await prisma.funcaoPastoral.findFirst({
      where: {
        pastoralId: funcao.pastoralId,
        nome: nome.trim(),
        id: {
          not: funcaoId
        }
      }
    })

    if (duplicada) {
      return res.status(409).json({
        mensagem: "Já existe uma função com esse nome nesta pastoral"
      })
    }

    const atualizada = await prisma.funcaoPastoral.update({
      where: {
        id: funcaoId
      },
      data: {
        nome: nome.trim(),
        ...(descricao !== undefined ? { descricao: descricao?.trim() || null } : {})
      }
    })

    return res.json(atualizada)

  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({ mensagem: "Já existe uma função com esse nome nesta pastoral" })
    }

    return next(error)
  }
}