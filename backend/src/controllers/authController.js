import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import prisma from "../lib/prisma.js"

export async function login(req, res, next) {
  try {
    const {
      email,
      senha,
      paroquiaId
    } = req.body ?? {}

    if (!email || !senha || !paroquiaId) {
      return res.status(400).json({
        mensagem: "Email, senha e paroquiaId são obrigatórios"
      })
    }

    if (
      typeof email !== "string" || !email.trim() ||
      typeof senha !== "string" ||
      !["string", "number"].includes(typeof paroquiaId)
    ) {
      return res.status(400).json({ mensagem: "Dados de login inválidos" })
    }

    const idParoquia = Number(paroquiaId)

    if (!Number.isInteger(idParoquia) || idParoquia < 1 || idParoquia > 2147483647) {
      return res.status(400).json({ mensagem: "paroquiaId inválido" })
    }

    const usuario = await prisma.usuario.findFirst({
      where: {
        email,
        paroquiaId: idParoquia,
        ativo: true,
        paroquia: { ativa: true }
      },
      include: {
        paroquia: {
          select: {
            id: true,
            nome: true
          }
        }
      }
    })

    if (!usuario) {
      return res.status(401).json({
        mensagem: "Email ou senha inválidos"
      })
    }

    const senhaValida = await bcrypt.compare(
      senha,
      usuario.senha
    )

    if (!senhaValida) {
      return res.status(401).json({
        mensagem: "Email ou senha inválidos"
      })
    }

    const token = jwt.sign(
      {
        usuarioId: usuario.id,
        paroquiaId: usuario.paroquiaId,
        tipo: usuario.tipo
      },
      process.env.JWT_SECRET,
      {
        algorithm: "HS256",
        expiresIn: "7d"
      }
    )

    return res.json({
      mensagem: "Login realizado com sucesso",

      token,

      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        tipo: usuario.tipo,

        paroquia: usuario.paroquia
      }
    })

  } catch (error) {
    return next(error)
  }
}
