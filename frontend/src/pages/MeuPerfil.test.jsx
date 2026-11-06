import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { AuthProvider } from "../contexts/AuthContext"
import { ThemeProvider } from "../contexts/ThemeContext"
import ProtectedRoute from "../components/ProtectedRoute"
import MeuPerfil from "./MeuPerfil"
import api from "../services/api"

vi.mock("../services/api", () => ({ default: { get: vi.fn(), patch: vi.fn(), put: vi.fn() } }))
vi.mock("../components/NotificacoesMenu", () => ({ default: () => null }))
const inicial = { id: 7, nome: "Maria Original", email: "maria@example.com", tipo: "MEMBRO", paroquia: { id: 3, nome: "Paróquia" }, coordenacoes: [] }
function abrir(usuario = inicial) {
  if (usuario) { localStorage.setItem("token", "token-atual"); localStorage.setItem("usuario", JSON.stringify(usuario)) }
  api.get.mockImplementation(async () => ({ data: usuario }))
  return render(<ThemeProvider><AuthProvider><MemoryRouter initialEntries={["/meu-perfil"]}><Routes>
    <Route path="/meu-perfil" element={<ProtectedRoute pessoal><MeuPerfil /></ProtectedRoute>} />
    <Route path="/login" element={<p>Entrar no SERVIRE</p>} />
    <Route path="/superadmin" element={<p>Painel global</p>} />
  </Routes></MemoryRouter></AuthProvider></ThemeProvider>)
}
beforeEach(() => { localStorage.clear(); vi.clearAllMocks() })
afterEach(cleanup)

describe("Meu Perfil", () => {
  it.each([
    ["SUPER_ADMIN", [], "Superadministrador"], ["ADMIN", [], "Administrador"],
    ["MEMBRO", [], "Membro"], ["MEMBRO", [{ id: 1, nome: "Música" }], "Coordenador de pastoral"]
  ])("permite acesso pessoal para %s e mostra cargo somente leitura", async (tipo, coordenacoes, rotulo) => {
    abrir({ ...inicial, tipo, coordenacoes, ...(tipo === "SUPER_ADMIN" ? { paroquia: null } : {}) })
    const campo = await screen.findByLabelText("Nível de acesso")
    expect(campo.value).toBe(rotulo); expect(campo.readOnly).toBe(true)
    expect(screen.getAllByRole("link", { name: "Meu Perfil" })).toHaveLength(1)
  })
  it("redireciona sessão ausente para login", async () => {
    abrir(null)
    expect(await screen.findByText("Entrar no SERVIRE")).toBeTruthy()
    expect(api.patch).not.toHaveBeenCalled()
  })
  it("salva dados e atualiza o nome no menu e no localStorage", async () => {
    abrir()
    fireEvent.change(await screen.findByLabelText("Nome completo"), { target: { value: "Maria Atualizada" } })
    api.patch.mockResolvedValue({ data: { usuario: { ...inicial, nome: "Maria Atualizada" }, mensagem: "Dados atualizados com sucesso." } })
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }))
    expect(await screen.findByText("Dados atualizados com sucesso.")).toBeTruthy()
    expect(screen.getByText("Maria Atualizada")).toBeTruthy()
    expect(JSON.parse(localStorage.getItem("usuario")).nome).toBe("Maria Atualizada")
    expect(api.patch).toHaveBeenCalledWith("/meu-perfil", { nome: "Maria Atualizada", email: inicial.email })
    expect(localStorage.getItem("token")).toBe("token-atual")
  })
  it("troca e-mail com senha atual e substitui o token da sessão", async () => {
    abrir()
    fireEvent.change(await screen.findByLabelText("E-mail"), { target: { value: "novo@example.com" } })
    fireEvent.change(screen.getByLabelText("Senha atual para alterar e-mail"), { target: { value: "SenhaAtual12345" } })
    api.patch.mockResolvedValue({ data: { usuario: { ...inicial, email: "novo@example.com" }, token: "token-renovado", mensagem: "E-mail atualizado." } })
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }))
    await screen.findByText("E-mail atualizado.")
    expect(localStorage.getItem("token")).toBe("token-renovado")
    expect(JSON.parse(localStorage.getItem("usuario")).email).toBe("novo@example.com")
    expect(screen.queryByLabelText("Senha atual para alterar e-mail")).toBeNull()
    expect(localStorage.getItem("usuario")).not.toContain("SenhaAtual12345")
  })
  it("erro de senha atual aparece sem alterar a sessão", async () => {
    abrir()
    fireEvent.change(await screen.findByLabelText("E-mail"), { target: { value: "novo@example.com" } })
    fireEvent.change(screen.getByLabelText("Senha atual para alterar e-mail"), { target: { value: "Errada" } })
    api.patch.mockRejectedValue({ response: { status: 403, data: { mensagem: "Senha atual incorreta" } } })
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }))
    expect((await screen.findByRole("alert")).textContent).toBe("Senha atual incorreta")
    expect(localStorage.getItem("token")).toBe("token-atual")
  })
  it("valida confirmação, mostra senha e limpa campos após atualizar", async () => {
    abrir(); await screen.findByLabelText("Nome completo")
    fireEvent.change(screen.getByLabelText("Senha atual"), { target: { value: "SenhaAtual12345" } })
    fireEvent.change(screen.getByLabelText("Nova senha"), { target: { value: "NovaSenhaSegura123" } })
    fireEvent.change(screen.getByLabelText("Confirmar nova senha"), { target: { value: "OutraSenhaSegura123" } })
    fireEvent.click(screen.getByRole("button", { name: "Atualizar senha" }))
    expect(screen.getByRole("alert").textContent).toContain("confirmação")
    expect(api.put).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Mostrar nova senha" }))
    expect(screen.getByLabelText("Nova senha").type).toBe("text")
    fireEvent.change(screen.getByLabelText("Confirmar nova senha"), { target: { value: "NovaSenhaSegura123" } })
    api.put.mockResolvedValue({ data: { usuario: inicial, token: "token-novo", mensagem: "Senha atualizada." } })
    fireEvent.click(screen.getByRole("button", { name: "Atualizar senha" }))
    await screen.findByText("Senha atualizada.")
    expect(screen.getByLabelText("Senha atual").value).toBe("")
    expect(screen.getByLabelText("Nova senha").value).toBe("")
    expect(screen.getByLabelText("Confirmar nova senha").value).toBe("")
    expect(localStorage.getItem("token")).toBe("token-novo")
  })
  it("bloqueia cliques repetidos enquanto a requisição está pendente", async () => {
    abrir(); await screen.findByLabelText("Nome completo")
    let resolver
    api.patch.mockReturnValue(new Promise(resolve => { resolver = resolve }))
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }))
    const botao = screen.getByRole("button", { name: "Salvando..." })
    expect(botao.closest("fieldset").disabled).toBe(true)
    fireEvent.click(botao)
    expect(api.patch).toHaveBeenCalledTimes(1)
    resolver({ data: { usuario: inicial, mensagem: "Salvo." } })
    await waitFor(() => expect(screen.getByText("Salvo.")).toBeTruthy())
  })
})
