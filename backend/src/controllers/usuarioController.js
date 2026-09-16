import bcrypt from "bcrypt"
import prisma from "../lib/prisma.js"

export async function criarUsuario(req, res, next) {
  try {
    const {
      nome,
      email,
      senha,
      telefone,
      tipo
    } = req.body ?? {}

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
          "Você não possui permissão para criar usuários"
      })
    }

    if (!nome || !email || !senha || !paroquiaId) {
      return res.status(400).json({
        mensagem: "Nome, email, senha e paroquiaId são obrigatórios"
      })
    }

    if (
      typeof nome !== "string" || !nome.trim() ||
      typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      typeof senha !== "string" || senha.length < 8
    ) {
      return res.status(400).json({
        mensagem: "Informe nome, email válido e senha com pelo menos 8 caracteres"
      })
    }

    if (telefone != null && typeof telefone !== "string") {
      return res.status(400).json({ mensagem: "Telefone deve ser um texto" })
    }

    const tipoUsuario = ehAdmin ? (tipo === undefined ? "MEMBRO" : tipo) : "MEMBRO"

    if (!["ADMIN", "MEMBRO"].includes(tipoUsuario)) {
      return res.status(400).json({ mensagem: "Tipo de usuário inválido" })
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

    const usuarioExistente = await prisma.usuario.findFirst({
      where: {
        email,
        paroquiaId: Number(paroquiaId)
      }
    })

    if (usuarioExistente) {
      return res.status(409).json({
        mensagem: "Já existe um usuário com este email nesta paróquia"
      })
    }

    const senhaCriptografada = await bcrypt.hash(senha, 10)

    const usuario = await prisma.usuario.create({
      data: {
        nome: nome.trim(),
        email,
        senha: senhaCriptografada,
        telefone: telefone?.trim() || null,
        tipo: tipoUsuario,
        paroquiaId: Number(paroquiaId)
      },
      select: {
        id: true,
        nome: true,
        email: true,
        telefone: true,
        tipo: true,
        ativo: true,
        paroquiaId: true,
        criadoEm: true
      }
    })

    return res.status(201).json(usuario)
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({
        mensagem: "Já existe um usuário com este email nesta paróquia"
      })
    }

    return next(error)
  }
}

export async function listarUsuarios(req, res, next) {
  try {
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
          "Você não possui permissão para listar usuários"
      })
    }

    const usuarios =
      await prisma.usuario.findMany({
        where: {
          paroquiaId:
            req.paroquiaId
        },

        select: {
          id: true,
          nome: true,
          email: true,
          telefone: true,
          tipo: true,
          ativo: true,
          criadoEm: true,

          paroquia: {
            select: {
              id: true,
              nome: true
            }
          }
        },

        orderBy: {
          nome: "asc"
        }
      })

    return res.json(usuarios)

  } catch (error) {
    return next(error)
  }
}

export async function atualizarUsuario(req, res, next) {
  try {
    if (req.tipoUsuario !== "ADMIN") {
      return res.status(403).json({
        mensagem: "Apenas administradores podem editar usuários"
      })
    }

    const usuarioId = Number(req.params.id)

    if (!usuarioId) {
      return res.status(400).json({
        mensagem: "Usuário inválido"
      })
    }

    const {
      nome,
      email,
      telefone,
      tipo,
      ativo
    } = req.body ?? {}

    const usuarioExistente = await prisma.usuario.findFirst({
      where: {
        id: usuarioId,
        paroquiaId: req.paroquiaId
      }
    })

    if (!usuarioExistente) {
      return res.status(404).json({
        mensagem: "Usuário não encontrado"
      })
    }

    const editandoProprioUsuario =
    usuarioId === req.usuarioId

    if (
      nome !== undefined &&
      (
        typeof nome !== "string" ||
        !nome.trim()
      )
    ) {
      return res.status(400).json({
        mensagem: "Nome inválido"
      })
    }

    if (
      email !== undefined &&
      (
        typeof email !== "string" ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      )
    ) {
      return res.status(400).json({
        mensagem: "Email inválido"
      })
    }

    if (
      telefone !== undefined &&
      telefone !== null &&
      typeof telefone !== "string"
    ) {
      return res.status(400).json({
        mensagem: "Telefone deve ser um texto"
      })
    }

    if (
      tipo !== undefined &&
      !["ADMIN", "MEMBRO"].includes(tipo)
    ) {
      return res.status(400).json({
        mensagem: "Tipo de usuário inválido"
      })
    }

    if (
      ativo !== undefined &&
      typeof ativo !== "boolean"
    ) {
      return res.status(400).json({
        mensagem: "Status ativo deve ser verdadeiro ou falso"
      })
    }

    if (email !== undefined) {
      const emailEmUso = await prisma.usuario.findFirst({
        where: {
          email,
          paroquiaId: req.paroquiaId,
          NOT: {
            id: usuarioId
          }
        }
      })

      if (emailEmUso) {
        return res.status(409).json({
          mensagem: "Já existe um usuário com este email nesta paróquia"
        })
      }
    }

    if (
      editandoProprioUsuario &&
      tipo !== undefined &&
      tipo !== "ADMIN"
    ) {
      return res.status(400).json({
        mensagem:
          "Você não pode remover sua própria permissão de administrador"
      })
    }

    if (
      editandoProprioUsuario &&
      ativo === false
    ) {
      return res.status(400).json({
        mensagem:
          "Você não pode desativar sua própria conta"
      })
    }

    const usuarioAtualizado = await prisma.usuario.update({
      where: {
        id: usuarioId
      },

      data: {
        ...(nome !== undefined && {
          nome: nome.trim()
        }),

        ...(email !== undefined && {
          email: email.trim()
        }),

        ...(telefone !== undefined && {
          telefone:
            telefone?.trim() || null
        }),

        ...(tipo !== undefined && {
          tipo
        }),

        ...(ativo !== undefined && {
          ativo
        })
      },

      select: {
        id: true,
        nome: true,
        email: true,
        telefone: true,
        tipo: true,
        ativo: true,
        paroquiaId: true,
        criadoEm: true
      }
    })

    return res.json(usuarioAtualizado)

  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({
        mensagem: "Já existe um usuário com este email nesta paróquia"
      })
    }

    return next(error)
  }
}
