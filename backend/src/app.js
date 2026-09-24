import { tratarErros } from "./middlewares/tratarErros.js"
import express from "express"
import cors from "cors"
import { validarOrigens } from "./config.js"

import paroquiaRoutes from "./routes/paroquiaRoutes.js"
import usuarioRoutes from "./routes/usuarioRoutes.js"
import pastoralRoutes from "./routes/pastoralRoutes.js"
import membroPastoralRoutes from "./routes/membroPastoralRoutes.js"
import funcaoPastoralRoutes from "./routes/funcaoPastoralRoutes.js"
import eventoRoutes from "./routes/eventoRoutes.js"
import escalaRoutes from "./routes/escalaRoutes.js"
import indisponibilidadeRoutes from "./routes/indisponibilidadeRoutes.js"
import authRoutes from "./routes/authRoutes.js"
import funcaoEscalaRoutes from "./routes/funcaoEscalaRoutes.js"
import notificacaoRoutes from "./routes/notificacaoRoutes.js"
import liturgiaRoutes from "./routes/liturgiaRoutes.js"

const app = express()
const proxyHops = Number(process.env.PROXY_HOPS ?? 0)
if (Number.isInteger(proxyHops) && proxyHops > 0) {
  app.set("trust proxy", proxyHops)
}

const origensPermitidas = validarOrigens(process.env)

function origemLocalPermitida(origem) {
  try {
    const url = new URL(origem)

    if (url.port !== "5173") {
      return false
    }

    const host = url.hostname

    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host.startsWith("192.168.") ||
      host.startsWith("10.") ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host)
    )
  } catch {
    return false
  }
}

app.use(
  cors({
    origin(origem, callback) {
      if (!origem) {
        return callback(null, true)
      }

      if (
        process.env.NODE_ENV !== "production" &&
        origemLocalPermitida(origem)
      ) {
        return callback(null, true)
      }

      return callback(
        null,
        origensPermitidas.includes(origem)
      )
    }
  })
)

app.use(express.json())

app.get("/", (req, res) => {
  res.json({
    mensagem: "API Sistema Paróquia funcionando"
  })
})

paroquiaRoutes(app)
usuarioRoutes(app)
pastoralRoutes(app)
membroPastoralRoutes(app)
funcaoPastoralRoutes(app)
eventoRoutes(app)
escalaRoutes(app)
indisponibilidadeRoutes(app)
authRoutes(app)
funcaoEscalaRoutes(app)
notificacaoRoutes(app)
liturgiaRoutes(app)

app.use((req, res) => {
  res.status(404).json({ mensagem: "Rota não encontrada" })
})

app.use(tratarErros)

export default app
