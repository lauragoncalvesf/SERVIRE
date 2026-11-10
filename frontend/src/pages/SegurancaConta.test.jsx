import { beforeEach, afterEach, expect, it, vi } from "vitest"
import { cleanup, render, screen, fireEvent } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { StrictMode } from "react"
import SegurancaConta from "./SegurancaConta"
import api from "../services/api"
vi.mock("../services/api", () => ({ default: { post: vi.fn() } }))
beforeEach(() => { vi.clearAllMocks(); window.history.replaceState(null, "", "/") })
afterEach(cleanup)
function abrir(modo) { return render(<StrictMode><MemoryRouter><SegurancaConta modo={modo} /></MemoryRouter></StrictMode>) }
it("pedido inclui a paróquia e mostra resposta genérica sem link", async () => {
  abrir("solicitar")
  fireEvent.change(screen.getByLabelText("Paróquia"), { target: { value: "3" } })
  fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "MEMBRO@example.com" } })
  api.post.mockResolvedValue({ data: { mensagem: "Se houver conta elegível, enviaremos instruções." } })
  fireEvent.click(screen.getByRole("button", { name: "Solicitar recuperação" }))
  expect(await screen.findByText("Se houver conta elegível, enviaremos instruções.")).toBeTruthy()
  expect(api.post).toHaveBeenCalledWith("/auth/esqueci-senha", { email: "membro@example.com", paroquiaId: 3 })
  expect(screen.queryByText(/#token=/)).toBeNull()
})
it("escopo global é nulo sem escolher uma paróquia automaticamente", async () => {
  abrir("solicitar")
  fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "global@example.com" } })
  api.post.mockResolvedValue({ data: { mensagem: "Pedido recebido." } })
  fireEvent.click(screen.getByRole("button", { name: "Solicitar recuperação" }))
  await screen.findByText("Pedido recebido.")
  expect(api.post.mock.calls[0][1].paroquiaId).toBeNull()
})
it("confirmação preserva token em StrictMode e não consome automaticamente ao abrir o link", async () => {
  const token = "a".repeat(64)
  window.history.replaceState(null, "", `/confirmar-email#token=${token}`)
  abrir("confirmar")
  expect(window.location.hash).toBe(""); expect(api.post).not.toHaveBeenCalled()
  api.post.mockResolvedValue({ data: { mensagem: "E-mail confirmado." } })
  fireEvent.click(screen.getByRole("button", { name: "Confirmar meu e-mail" }))
  await screen.findByText("E-mail confirmado.")
  expect(api.post).toHaveBeenCalledWith("/auth/confirmar-email", { token })
})
it("redefinição valida confirmação e termina no login sem gravar sessão", async () => {
  const token = "b".repeat(64)
  window.history.replaceState(null, "", `/redefinir-senha#token=${token}`)
  abrir("redefinir")
  fireEvent.change(screen.getByLabelText("Nova senha"), { target: { value: "NovaSenhaSegura123" } })
  fireEvent.change(screen.getByLabelText("Confirmar nova senha"), { target: { value: "DiferenteSegura123" } })
  fireEvent.click(screen.getByRole("button", { name: "Salvar nova senha" }))
  expect(screen.getByRole("alert").textContent).toContain("iguais"); expect(api.post).not.toHaveBeenCalled()
  api.post.mockResolvedValue({ data: { mensagem: "Entre novamente." } })
  fireEvent.change(screen.getByLabelText("Confirmar nova senha"), { target: { value: "NovaSenhaSegura123" } })
  fireEvent.click(screen.getByRole("button", { name: "Salvar nova senha" }))
  await screen.findByText("Entre novamente.")
  expect(api.post).toHaveBeenCalledWith("/auth/redefinir-senha", { token, novaSenha: "NovaSenhaSegura123", confirmarSenha: "NovaSenhaSegura123" })
  expect(screen.getByRole("link", { name: "Voltar ao login" }).getAttribute("href")).toBe("/login")
  expect(window.location.hash).toBe("")
})
it("link ausente bloqueia submissão e erro de link expirado é exibido", async () => {
  const tela = abrir("confirmar")
  expect(screen.getByRole("button", { name: "Confirmar meu e-mail" }).disabled).toBe(true)
  tela.unmount()
  window.history.replaceState(null, "", `/confirmar-email#token=${"c".repeat(64)}`)
  abrir("confirmar")
  api.post.mockRejectedValue({ response: { data: { mensagem: "Link inválido ou expirado" } } })
  fireEvent.click(screen.getByRole("button", { name: "Confirmar meu e-mail" }))
  expect((await screen.findByRole("alert")).textContent).toBe("Link inválido ou expirado")
})
