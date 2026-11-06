import { useEffect, useState } from "react"
import AppLayout from "../components/AppLayout"
import api from "../services/api"
import "./Superadmin.css"

const vazio = { nome: "", cidade: "", estado: "", telefone: "", email: "" }
export default function Superadmin() {
  const [indicadores, setIndicadores] = useState(null)
  const [lista, setLista] = useState({ dados: [], total: 0 })
  const [busca, setBusca] = useState("")
  const [status, setStatus] = useState("")
  const [pagina, setPagina] = useState(1)
  const [selecionada, setSelecionada] = useState(null)
  const [admins, setAdmins] = useState([])
  const [form, setForm] = useState(null)
  const [mensagem, setMensagem] = useState("")
  const [convite, setConvite] = useState(null)
  const [ocupado, setOcupado] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [revisao, setRevisao] = useState(0)
  useEffect(() => {
    let atual = true
    Promise.all([api.get("/superadmin/dashboard"), api.get("/superadmin/paroquias", { params: { busca, status, pagina } })]).then(([dash, paroquias]) => {
      if (atual) { setIndicadores(dash.data); setLista(paroquias.data); setSelecionada(anterior => anterior ? paroquias.data.dados.find(p => p.id === anterior.id) || anterior : null) }
    }).catch(erro => { if (atual) setMensagem(erro.response?.data?.mensagem || "Falha ao carregar dados") }).finally(() => { if (atual) setCarregando(false) })
    return () => { atual = false }
  }, [busca, status, pagina, revisao])
  async function abrir(paroquia) {
    setSelecionada(paroquia); setAdmins([]); setOcupado(true)
    try { const { data } = await api.get(`/superadmin/paroquias/${paroquia.id}/admins`); setAdmins(data) }
    catch (erro) { setMensagem(erro.response?.data?.mensagem || "Falha ao carregar administradores") }
    finally { setOcupado(false) }
  }
  async function executar(acao) {
    setOcupado(true); setMensagem("")
    try {
      const resultado = await acao()
      if (resultado?.data?.convite) setConvite({ ...resultado.data.convite, envio: resultado.data.envio })
      setMensagem(resultado?.data?.envio ? ({ enviado: "Convite enviado: aceito pelo servidor de e-mail.", nao_enviado: "Convite criado, mas o envio de e-mail não foi confirmado. Copie o link manual.", nao_configurado: "Convite criado. Envio de e-mail não configurado; copie o link manual." }[resultado.data.envio.status] || "Verifique o status do convite.") : "Operação concluída."); setRevisao(v => v + 1)
      if (selecionada) { const { data } = await api.get(`/superadmin/paroquias/${selecionada.id}/admins`); setAdmins(data) }
      return true
    } catch (erro) { setMensagem(erro.response?.data?.mensagem || "Não foi possível concluir a operação"); return false }
    finally { setOcupado(false) }
  }
  async function salvar(event) {
    event.preventDefault()
    const { categoria, id, ...dados } = form
    const caminho = categoria === "paroquia" ? `/superadmin/paroquias${id ? `/${id}` : ""}` : id ? `/superadmin/admins/${id}` : `/superadmin/paroquias/${selecionada.id}/admins`
    if (await executar(() => id ? api.put(caminho, dados) : api.post(caminho, dados))) setForm(null)
  }
  function editar(categoria, dados = vazio) { setForm({ ...vazio, ...dados, categoria }) }
  return <AppLayout titulo="Administração geral" subtitulo="Paróquias e administradores do SERVIRE"><div className="superadmin space-y-6">
    <div role="status" aria-live="polite">{mensagem}</div>
    {ocupado && <p role="status">Processando operação...</p>}
    {carregando && <p role="status">Carregando plataforma...</p>}
    {indicadores && <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">{[["Paróquias", indicadores.total], ["Ativas", indicadores.ativas], ["Inativas", indicadores.inativas], ["Administradores", indicadores.administradores]].map(([rotulo, valor]) => <section key={rotulo} className="bg-white rounded-2xl p-5 border border-[#EFE8D6]"><p>{rotulo}</p><strong className="text-3xl text-[#1D5C9E]">{valor}</strong></section>)}</div>}
    <section className="bg-white rounded-2xl p-5 space-y-4">
      <div className="flex flex-wrap justify-between gap-3"><h2 className="text-xl font-bold">Paróquias cadastradas</h2><button disabled={ocupado} onClick={() => editar("paroquia")}>Cadastrar paróquia</button></div>
      <div className="flex flex-wrap gap-3"><label>Buscar por nome ou cidade<input type="search" value={busca} onChange={e => { setBusca(e.target.value); setPagina(1) }} /></label><label>Status<select value={status} onChange={e => { setStatus(e.target.value); setPagina(1) }}><option value="">Todas</option><option value="ativa">Ativas</option><option value="inativa">Inativas</option></select></label></div>
      {!carregando && !lista.dados.length && <p>Nenhuma paróquia encontrada.</p>}
      <div className="space-y-3">{lista.dados.map(p => <article key={p.id} className="border rounded-xl p-4 flex flex-wrap gap-3 justify-between"><div><h3 className="font-bold">{p.nome} · #{p.id}</h3><p>{[p.cidade, p.estado].filter(Boolean).join(" / ")} · {p.ativa ? "Ativa" : "Inativa"}</p></div><div className="flex flex-wrap gap-2"><button disabled={ocupado} onClick={() => abrir(p)}>Detalhes e administradores</button><button disabled={ocupado} onClick={() => editar("paroquia", p)}>Editar</button><button disabled={ocupado} onClick={() => { if (window.confirm(`${p.ativa ? "Desativar" : "Ativar"} ${p.nome}? Os acessos serão atualizados.`)) executar(() => api.patch(`/superadmin/paroquias/${p.id}/status`, { ativa: !p.ativa })) }}>{p.ativa ? "Desativar" : "Ativar"}</button></div></article>)}</div>
      <div className="flex gap-3 items-center"><button disabled={pagina === 1 || ocupado} onClick={() => setPagina(v => v - 1)}>Anterior</button><span>Página {pagina} · {lista.total} registros</span><button disabled={pagina * 20 >= lista.total || ocupado} onClick={() => setPagina(v => v + 1)}>Próxima</button></div>
    </section>
    {selecionada && <section className="bg-white p-5 rounded-2xl space-y-4"><div className="flex flex-wrap justify-between gap-3"><h2 className="text-xl font-bold">{selecionada.nome} · Administradores</h2><button disabled={ocupado || !selecionada.ativa} onClick={() => editar("admin")}>Adicionar administrador</button></div><p>{selecionada.email || "Sem e-mail"} · {selecionada.telefone || "Sem telefone"}</p><p>Na transferência, o administrador anterior passa a membro e o sucessor permanece administrador da mesma paróquia.</p>
      {!admins.length && <p>Nenhum administrador cadastrado.</p>}
      {admins.map(a => <article key={a.id} className="border rounded-xl p-4 space-y-3"><p><strong>{a.nome}</strong> · {a.email} · {a.ativo ? "Ativo" : "Inativo"}</p><div className="flex flex-wrap gap-2"><button disabled={ocupado} onClick={() => editar("admin", a)}>Editar</button><button disabled={ocupado} onClick={() => { if (window.confirm("Alterar status deste administrador?")) executar(() => api.patch(`/superadmin/admins/${a.id}/status`, { ativo: !a.ativo })) }}>{a.ativo ? "Desativar" : "Ativar"}</button><button disabled={ocupado || !a.ativo} onClick={() => { if (window.confirm("Gerar novo convite? O anterior será invalidado.")) executar(() => api.post(`/superadmin/admins/${a.id}/convite`)) }}>Gerar convite</button><label>Transferir para<select disabled={ocupado || !a.ativo} value="" onChange={e => { if (e.target.value && window.confirm("Transferir a responsabilidade e tornar a conta anterior membro?")) executar(() => api.post(`/superadmin/admins/${a.id}/transferir`, { sucessorId: Number(e.target.value) })) }}><option value="">Selecionar sucessor</option>{admins.filter(s => s.ativo && s.id !== a.id).map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}</select></label></div></article>)}
    </section>}
    {form && <div className="fixed inset-0 bg-black/40 z-50 flex justify-center items-center p-4"><section role="dialog" aria-modal="true" aria-labelledby="form-titulo" className="bg-white rounded-2xl p-6 w-full max-w-xl max-h-[90dvh] overflow-auto"><h2 id="form-titulo" className="text-xl font-bold mb-4">{form.id ? "Editar" : "Cadastrar"} {form.categoria === "paroquia" ? "paróquia" : "administrador"}</h2><form onSubmit={salvar} className="space-y-3">{(form.categoria === "paroquia" ? ["nome", "cidade", "estado", "telefone", "email"] : ["nome", "email", "telefone"]).map(campo => <label className="block capitalize" key={campo}>{campo}<input autoFocus={campo === "nome"} required={campo === "nome" || (campo === "email" && form.categoria === "admin")} type={campo === "email" ? "email" : campo === "telefone" ? "tel" : "text"} maxLength={campo === "estado" ? 2 : 200} value={form[campo] || ""} onChange={e => setForm({ ...form, [campo]: e.target.value })} /></label>)}{mensagem && <p role="alert">{mensagem}</p>}<div className="flex gap-3"><button disabled={ocupado}>{ocupado ? "Salvando..." : "Salvar"}</button><button type="button" disabled={ocupado} onClick={() => setForm(null)}>Cancelar</button></div></form></section></div>}
    {convite && <div className="fixed inset-0 bg-black/40 z-50 flex justify-center items-center p-4"><section role="dialog" aria-modal="true" aria-labelledby="convite-titulo" className="bg-white rounded-2xl p-6 w-full max-w-xl space-y-4"><h2 id="convite-titulo" className="font-bold text-xl">Convite gerado</h2><p role="status">{convite.envio?.status === "enviado" ? "Enviado — o servidor SMTP aceitou o e-mail. Oriente o administrador a verificar também a pasta de spam." : convite.envio?.status === "nao_configurado" ? "Envio não configurado — o convite pode ser entregue manualmente." : "Não enviado — não houve confirmação do SMTP. O administrador continua cadastrado e o convite permanece válido."}</p><p>Validade até {new Date(convite.expiraEm).toLocaleString("pt-BR")}.</p>
      {convite.token && <><p>Copie o link e entregue por um canal privado. Ele será exibido somente agora. Gerar outro convite invalida este.</p>{!convite.link && <p role="alert">A URL pública do frontend precisa ser configurada no backend. Confira o endereço abaixo antes de compartilhar; ele usa o endereço desta página como alternativa manual.</p>}<label>Link do convite<textarea readOnly value={convite.link || `${window.location.origin}/aceitar-convite#token=${convite.token}`} onFocus={e => e.target.select()} /></label></>}
      <button onClick={() => setConvite(null)}>Fechar</button></section></div>}
  </div></AppLayout>
}
