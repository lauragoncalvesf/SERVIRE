import "dotenv/config"
import { validarConfiguracao } from "./config.js"

const { porta } = validarConfiguracao(process.env)
const { default: app } = await import("./app.js")

app.listen(porta, "0.0.0.0", () => {
  console.log(`Servidor rodando na porta ${porta}`)
})
