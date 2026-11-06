import bcrypt from "bcrypt"
import { assinarToken } from "../services/sessaoService.js"
import prisma from "../lib/prisma.js"

export async function login(req, res, next) {
  try {
    const {
      email,
      senha,
      paroquiaId
    } = req.body ?? {}

    if (!email || !senha) {
      return res.status(400).json({
        mensagem: "Email e senha são obrigatórios"
      })
    }

    if (
      typeof email !== "string" || !email.trim() ||
      typeof senha !== "string" ||
      (paroquiaId != null && paroquiaId !== "" && !["string", "number"].includes(typeof paroquiaId))
    ) {
      return res.status(400).json({ mensagem: "Dados de login inválidos" })
    }

    const idParoquia = paroquiaId == null || paroquiaId === "" ? null : Number(paroquiaId)

    if (idParoquia !== null && (!Number.isInteger(idParoquia) || idParoquia < 1 || idParoquia > 2147483647)) {
      return res.status(400).json({ mensagem: "paroquiaId inválido" })
    }

    const usuario = await prisma.usuario.findFirst({
      where: {
        email: { equals: email.trim(), mode: "insensitive" },
        paroquiaId: idParoquia,
        ativo: true,
        ...(idParoquia === null ? { tipo: "SUPER_ADMIN" } : { paroquia: { ativa: true } })
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

    const token = assinarToken(usuario)

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
