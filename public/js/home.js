import { conectar, ordenar, el, capa, iniciais, CORES_STATUS } from "./ao-vivo.js";
import { Roleta } from "./roleta.js";

const ALTURA = 92;
let estado = null;
const linhas = {}; // id -> { li, roleta }

/* ---------- ranking ---------- */
function renderRanking() {
  const box = document.getElementById("ranking");
  const ordem = ordenar(estado.opcoes);
  const max = Math.max(1, ...ordem.map(j => j.votos));
  const ids = new Set(ordem.map(j => j.id));
  Object.keys(linhas).forEach(id => { if (!ids.has(id)) { linhas[id].li.remove(); delete linhas[id]; } });

  ordem.forEach((j, i) => {
    let l = linhas[j.id];
    if (!l) {
      const li = el("li", "linha-rank");
      const pos = el("span", "pos");
      const meio = el("div", "meio");
      meio.append(el("span", "nome", j.nome), Object.assign(el("div", "trilho"), { innerHTML: "<i></i>" }));
      const nums = el("div", "numeros");
      const slot = el("span");
      nums.append(slot, el("span", "pct"));
      li.append(pos, capa(j.capa, j.nome), meio, nums);
      box.appendChild(li);
      l = linhas[j.id] = { li, roleta: new Roleta(slot), capaUrl: j.capa };
    }
    if (l.capaUrl !== j.capa) { l.li.children[1].replaceWith(capa(j.capa, j.nome)); l.capaUrl = j.capa; }
    l.li.style.top = i * ALTURA + "px";
    l.li.querySelector(".pos").textContent = i + 1;
    l.li.querySelector(".nome").textContent = j.nome;
    l.li.querySelector(".trilho i").style.width = (j.votos / max * 100) + "%";
    l.li.querySelector(".pct").textContent = estado.total ? Math.round(j.votos / estado.total * 100) + "%" : "0%";
    l.li.classList.toggle("lider", i === 0 && j.votos > 0);
    l.roleta.definir(j.votos);
  });
  box.style.height = ordem.length * ALTURA + "px";
}

/* ---------- lateral ---------- */
function renderLateral() {
  const ordem = ordenar(estado.opcoes);
  const [a, b] = ordem;
  const rot = document.getElementById("liderRotulo"), nome = document.getElementById("liderNome"), info = document.getElementById("liderInfo");
  const capaBox = document.getElementById("liderCapa");
  if (!a || !a.votos) {
    rot.textContent = "Na frente"; nome.textContent = "Nenhum voto ainda"; info.textContent = "O primeiro voto abre a corrida.";
  } else if (b && a.votos === b.votos) {
    const empatados = ordem.filter(j => j.votos === a.votos);
    rot.textContent = "Empate";
    nome.textContent = empatados.length === 2 ? empatados.map(j => j.nome).join(" e ") : `${empatados.length} jogos empatados`;
    info.innerHTML = ""; info.append(Object.assign(el("b"), { textContent: a.votos }), document.createTextNode(` ${a.votos === 1 ? "voto" : "votos"} cada`));
  } else {
    rot.textContent = "Na frente";
    nome.textContent = a.nome;
    const dif = a.votos - (b?.votos || 0);
    info.innerHTML = "";
    info.append(Object.assign(el("b"), { textContent: a.votos }), document.createTextNode(` votos · ${dif} à frente${b ? " de " + b.nome : ""}`));
  }
  const lider = a && a.votos ? a : null;
  const chave = lider ? lider.id + "|" + (lider.capa || "") : "";
  if (capaBox.dataset.chave !== chave) {
    const nova = lider ? capa(lider.capa, lider.nome, "lider-capa capa") : el("div", "lider-capa capa");
    nova.id = "liderCapa"; nova.dataset.chave = chave;
    capaBox.replaceWith(nova);
  }

  const feed = document.getElementById("feed");
  feed.replaceChildren();
  const ult = estado.ultimos.slice(0, 5);
  if (!ult.length) feed.append(el("li", "vazio", "Os votos aparecem aqui."));
  ult.forEach(u => {
    const li = el("li");
    const txt = el("span", "txt");
    txt.append(el("b", null, u.quem), document.createTextNode(" votou em "), el("b", null, u.jogo));
    li.append(el("span", "av", iniciais(u.quem)), txt);
    feed.append(li);
  });
  document.getElementById("total").textContent = estado.total;

  const selo = document.getElementById("selo");
  selo.classList.toggle("aovivo", !!estado.aoVivo);
  document.getElementById("seloTxt").textContent = estado.aoVivo ? "Contando ao vivo" : "Votação aberta";
}

/* ---------- galeria ---------- */
function pilula(texto, cor) { return texto ? el("span", "pilula " + (cor || ""), texto) : null; }

function renderGaleria() {
  const box = document.getElementById("cards");
  box.replaceChildren();
  const ordem = ordenar(estado.opcoes);
  ordem.forEach((j, i) => {
    const card = el("article", "card-jogo");
    const corpo = el("div", "corpo");
    const props = el("div", "props");
    // no card, só os gêneros da Steam (status, tipo e "já tem" são coisas internas do Ric)
    (j.generos || []).slice(0, 2).forEach(g => props.append(pilula(g, "roxo")));
    const rodape = el("div", "rodape");
    const votos = el("span");
    votos.append(el("b", null, j.votos), document.createTextNode(j.votos === 1 ? " voto" : " votos"));
    rodape.append(votos, el("span", "posicao", j.votos ? `${i + 1}º` : "–"));
    corpo.append(el("h3", null, j.nome), props, rodape);
    card.append(capa(j.capa, j.nome), corpo);
    box.append(card);
  });
}

/* ---------- sinopses ---------- */
function renderSinopses() {
  const box = document.getElementById("listaSinopses");
  box.replaceChildren();
  estado.opcoes.forEach(j => {
    const item = el("article", "sinopse");
    const texto = el("div");
    const meta = el("div", "meta");
    [j.generos?.join(", "), j.lancamento, j.desenvolvedora].filter(Boolean).forEach(m => meta.append(el("span", null, m)));
    texto.append(el("h3", "display", j.nome), meta);
    texto.append(j.sinopse ? el("p", null, j.sinopse) : el("p", "sem", "Sinopse ainda não encontrada."));
    if (j.lojaUrl) { const a = el("a", "link-loja", "Ver na Steam ↗"); a.href = j.lojaUrl; a.target = "_blank"; a.rel = "noopener"; texto.append(a); }
    item.append(capa(j.fundo || j.capa, j.nome), texto);
    box.append(item);
  });
}

/* ---------- biblioteca ---------- */
const COLUNAS = [
  { chave: "nome", titulo: "Nome" },
  { chave: "status", titulo: "Status" },
  { chave: "tipo", titulo: "Tipo" },
  { chave: "plataforma", titulo: "Plataforma" },
  { chave: "adquirido", titulo: "Adquirido?" },
  { chave: "preco", titulo: "Preço", num: true },
  { chave: "promo", titulo: "Promo", num: true },
  { chave: "opcao", titulo: "Na votação" }
];
const tabela = { busca: "", status: "Todos", ordem: "nome", dir: 1 };
const real = v => v == null ? "" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function montarCabecalho() {
  const tr = document.getElementById("cabecalho");
  tr.replaceChildren();
  COLUNAS.forEach(c => {
    const th = el("th", c.num ? "num" : "", c.titulo);
    if (tabela.ordem === c.chave) th.append(el("span", "seta", tabela.dir > 0 ? "↑" : "↓"));
    th.onclick = () => { tabela.dir = tabela.ordem === c.chave ? -tabela.dir : 1; tabela.ordem = c.chave; montarCabecalho(); renderTabela(); };
    tr.append(th);
  });
}
function montarFiltros() {
  const box = document.getElementById("filtros");
  box.replaceChildren();
  ["Todos", "Na votação", ...Object.keys(CORES_STATUS)].forEach(s => {
    const b = el("button", "filtro", s);
    b.setAttribute("aria-pressed", String(tabela.status === s));
    b.onclick = () => { tabela.status = s; montarFiltros(); renderTabela(); };
    box.append(b);
  });
}
function renderTabela() {
  const corpo = document.getElementById("linhas");
  const termo = tabela.busca.toLowerCase();
  let lista = estado.biblioteca.filter(j =>
    (!termo || j.nome.toLowerCase().includes(termo)) &&
    (tabela.status === "Todos" || (tabela.status === "Na votação" ? j.opcao : j.status === tabela.status)));
  const c = tabela.ordem;
  lista.sort((a, b) => {
    const va = a[c], vb = b[c];
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    return (typeof va === "string" ? va.localeCompare(vb) : Number(va) - Number(vb)) * tabela.dir;
  });
  corpo.replaceChildren();
  if (!lista.length) { const tr = el("tr"); const td = el("td", "vazio-tabela", "Nenhum jogo com esse filtro."); td.colSpan = COLUNAS.length; tr.append(td); corpo.append(tr); }
  lista.forEach(j => {
    const tr = el("tr");
    const nome = el("td"); const cel = el("div", "cel-nome"); cel.append(capa(j.capa, j.nome), el("span", null, j.nome)); nome.append(cel);
    const st = el("td"); if (j.status) st.append(pilula(j.status, CORES_STATUS[j.status]));
    const tipo = el("td"); if (j.tipo) tipo.append(pilula(j.tipo));
    const plat = el("td", null, j.plataforma || "");
    const adq = el("td"); if (j.adquirido) adq.append(pilula(j.adquirido, j.adquirido === "Sim" ? "verde" : j.adquirido === "Família Steam" ? "azul" : "cinza"));
    const preco = el("td", "num", real(j.preco));
    const promo = el("td", "num", real(j.promo));
    const op = el("td"); op.append(el("span", "check" + (j.opcao ? " on" : "")));
    tr.append(nome, st, tipo, plat, adq, preco, promo, op);
    corpo.append(tr);
  });
  document.getElementById("contagem").textContent = `${lista.length} de ${estado.biblioteca.length} jogos`;
}
document.getElementById("busca").addEventListener("input", e => { tabela.busca = e.target.value; renderTabela(); });

/* ---------- ao vivo ---------- */
let assinaturaGaleria = "";
function renderTudo() {
  renderRanking();
  renderLateral();
  // galeria, sinopses e tabela só redesenham quando algo muda nelas
  const assinatura = JSON.stringify(estado.biblioteca.map(j => [j.id, j.nome, j.opcao, j.status, j.tipo, j.adquirido, j.capa, j.sinopse, j.votos, j.preco, j.promo, j.plataforma]));
  if (assinatura !== assinaturaGaleria) {
    assinaturaGaleria = assinatura;
    renderGaleria(); renderSinopses(); renderTabela();
  }
}

conectar({
  aoEstado: s => { estado = s; renderTudo(); },
  aoVoto: v => {
    const l = linhas[v.jogoId];
    if (!l) return;
    l.roleta.votar(v.quem, v.votos);
    l.li.classList.remove("flash"); void l.li.offsetWidth; l.li.classList.add("flash");
  }
});

montarCabecalho();
montarFiltros();
addEventListener("scroll", () => document.getElementById("nav").classList.toggle("rolou", scrollY > 8), { passive: true });
