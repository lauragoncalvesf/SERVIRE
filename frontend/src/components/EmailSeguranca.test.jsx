import { beforeEach, afterEach, expect, it, vi } from "vitest"
import { cleanup, render, screen, fireEvent } from "@testing-library/react"
import ConfirmacaoEmailPerfil from "./ConfirmacaoEmailPerfil"
import AutorizarEmailModal from "./AutorizarEmailModal"
import api from "../services/api"
vi.mock("../services/api", () => ({ default: { post: vi.fn(), get: vi.fn() } }))
const usuario = { id: 3, nome: "Maria", email: "maria@example.com", emailAutorizadoEm: null, emailConfirmadoEm: null }
beforeEach(() => vi.clearAllMocks())
afterEach(cleanup)
it("Meu Perfil explica pendência e exige solicitação explícita com senha", async () => {
  const atualizado = vi.fn()
  render(<ConfirmacaoEmailPerfil perfil={usuario} aoAtualizar={atualizado} />)
  expect(screen.getByRole("status").textContent).toContain("Pendente")
  expect(api.post).not.toHaveBeenCalled()
  fireEvent.change(screen.getByLabelText("Sua senha atual"), { target: { value: "SenhaAtual12345" } })
  api.post.mockResolvedValue({ data: { mensagem: "Confirmação enviada." } })
  api.get.mockResolvedValue({ data: { ...usuario, emailAutorizadoEm: "2026-11-09" } })
  fireEvent.click(screen.getByRole("button", { name: "Autorizar e confirmar este e-mail" }))
  await screen.findByText("Confirmação enviada.")
  expect(api.post).toHaveBeenCalledWith("/meu-perfil/email/confirmacao", { senhaAtual: "SenhaAtual12345", emailEsperado: usuario.email })
  expect(atualizado).toHaveBeenCalled()
})
it("endereço confirmado mostra estado claro sem reenviar ao montar", () => {
  render(<ConfirmacaoEmailPerfil perfil={{ ...usuario, emailAutorizadoEm: "data", emailConfirmadoEm: "data" }} aoAtualizar={vi.fn()} />)
  expect(screen.getByRole("status").textContent).toContain("Confirmado")
  expect(screen.queryByRole("button")).toBeNull(); expect(api.post).not.toHaveBeenCalled()
})
it.each([false, true])("administração separa autorização e envio, com rota global=%s", async global => {
  render(<AutorizarEmailModal usuario={usuario} global={global} fechar={vi.fn()} />)
  fireEvent.click(screen.getByRole("checkbox"))
  fireEvent.change(screen.getByLabelText("Sua senha atual"), { target: { value: "SenhaAtual12345" } })
  api.post.mockResolvedValueOnce({ data: { mensagem: "Vínculo autorizado." } }).mockResolvedValueOnce({ data: { mensagem: "Enviado." } })
  fireEvent.click(screen.getByRole("button", { name: "Registrar autorização do vínculo" }))
  await screen.findByText("Vínculo autorizado.")
  const base = global ? "/superadmin/admins/3" : "/usuarios/3"
  expect(api.post).toHaveBeenCalledTimes(1)
  expect(api.post.mock.calls[0]).toEqual([`${base}/email/autorizar`, { senhaAtual: "SenhaAtual12345", emailEsperado: usuario.email, identidadeConferida: true }])
  fireEvent.click(screen.getByRole("button", { name: "Enviar confirmação ao titular" }))
  await screen.findByText("Enviado.")
  expect(api.post.mock.calls[1][0]).toBe(`${base}/email/confirmacao`)
})
