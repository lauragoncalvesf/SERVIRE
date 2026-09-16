import prisma from "../lib/prisma.js"

export async function criarParoquia(req, res, next) {
  try {
    const {
      nome,
      cidade,
      estado,
      telefone,
      email
    } = req.body ?? {}

    if (typeof nome !== "string" || !nome.trim()) {
      return res.status(400).json({
        mensagem: "O nome da paróquia é obrigatório"
      })
    }

    for (const [campo, valor] of Object.entries({ cidade, estado, telefone, email })) {
      if (valor != null && typeof valor !== "string") {
        return res.status(400).json({ mensagem: `${campo} deve ser um texto` })
      }
    }

    const paroquia = await prisma.paroquia.create({
      data: {
        nome: nome.trim(),
        cidade: cidade?.trim() || null,
        estado: estado?.trim() || null,
        telefone: telefone?.trim() || null,
        email: email?.trim() || null
      }
    })

    return res.status(201).json(paroquia)
  } catch (error) {
    return next(error)
  }
}

export async function listarParoquias(req, res, next) {
  try {
    const paroquias = await prisma.paroquia.findMany({
      where: { ativa: true },
      select: {
        id: true,
        nome: true,
        cidade: true,
        estado: true
      },
      orderBy: {
        nome: "asc"
      }
    })

    return res.json(paroquias)
  } catch (error) {
    return next(error)
  }
}
