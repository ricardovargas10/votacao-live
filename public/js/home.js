// Páginas Séries, Jogos e Biblioteca: cada página desenha só as partes que ela tem.
// Séries e Jogos usam o mesmo código; a página de Jogos tem <html data-lista="entre">.
import { conectar, ordenar, el, capa, iniciais, porcentagemMeta, LISTA } from "./ao-vivo.js";
import { Roleta } from "./roleta.js";

const ALTURA = 92;
const $ = id => document.getElementById(id);
let estado = null;
const linhas = {}; // id -> { li, roleta }

/* ---------- ranking ---------- */
function renderRanking() {
  const box = $("ranking");
  const ordem = ordenar(estado.opcoes);
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
    // barra e % = quanto da meta o jogo já juntou
    const pct = porcentagemMeta(j);
    l.li.querySelector(".trilho i").style.width = pct + "%";
    l.li.querySelector(".pct").textContent = `${pct}% da meta`;
    l.li.title = `${j.votos} de ${j.metaVotos} votos da meta`;
    l.li.classList.toggle("lider", i === 0 && j.votos > 0);
    l.li.classList.toggle("batida", pct >= 100);
    l.roleta.definir(j.votos);
  });
  box.style.height = ordem.length * ALTURA + "px";
}

/* ---------- lateral ---------- */
function renderLateral() {
  const ordem = ordenar(estado.opcoes);
  const [a, b] = ordem;
  const rot = $("liderRotulo"), nome = $("liderNome"), info = $("liderInfo");
  const capaBox = $("liderCapa");
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
    info.append(Object.assign(el("b"), { textContent: a.votos }), document.createTextNode(` votos · ${porcentagemMeta(a)}% da meta · ${dif} à frente${b ? " de " + b.nome : ""}`));
  }
  const lider = a && a.votos ? a : null;
  const chave = lider ? lider.id + "|" + (lider.capa || "") : "";
  if (capaBox.dataset.chave !== chave) {
    const nova = lider ? capa(lider.capa, lider.nome, "lider-capa capa") : el("div", "lider-capa capa");
    nova.id = "liderCapa"; nova.dataset.chave = chave;
    capaBox.replaceWith(nova);
  }

  const feed = $("feed");
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
  $("total").textContent = estado.total;
}

/* ---------- galeria ---------- */
function pilula(texto, cor) { return texto ? el("span", "pilula " + (cor || ""), texto) : null; }

function renderGaleria() {
  const box = $("cards");
  box.replaceChildren();
  ordenar(estado.opcoes).forEach((j, i) => {
    const card = el("article", "card-jogo");
    const corpo = el("div", "corpo");
    const props = el("div", "props");
    // no card, só os gêneros da Steam (status, tipo e "já tem" são coisas internas do Ric)
    (j.generos || []).slice(0, 2).forEach(g => props.append(pilula(g, "roxo")));
    const rodape = el("div", "rodape");
    if (LISTA === "frequentes") {
      // Frequentes não têm votação: o rodapé só diz que o jogo aparece sempre
      rodape.append(el("span", null, "Sempre no canal"));
    } else {
      const votos = el("span");
      votos.append(el("b", null, j.votos), document.createTextNode(` de ${j.metaVotos} votos · ${porcentagemMeta(j)}% da meta`));
      rodape.append(votos, el("span", "posicao", j.votos ? `${i + 1}º` : "–"));
    }
    corpo.append(el("h3", null, j.nome), props, rodape);
    card.append(capa(j.capa, j.nome), corpo);
    box.append(card);
  });
}

/* ---------- sinopses ---------- */
function renderSinopses() {
  const box = $("listaSinopses");
  box.replaceChildren();
  estado.opcoes.forEach(j => {
    const item = el("article", "sinopse");
    const texto = el("div");
    const meta = el("div", "meta");
    [j.generos?.join(", "), j.lancamento, j.desenvolvedora].filter(Boolean).forEach(m => meta.append(el("span", null, m)));
    texto.append(el("h3", "display", j.nome), meta);
    texto.append(j.sinopse ? el("p", null, j.sinopse) : el("p", "sem", "Sinopse ainda não encontrada."));
    if (j.lojaUrl) { const a = el("a", "link-loja", `${j.lojaNome || "Ver na Steam"} ↗`); a.href = j.lojaUrl; a.target = "_blank"; a.rel = "noopener"; texto.append(a); }
    item.append(capa(j.fundo || j.capa, j.nome), texto);
    box.append(item);
  });
}

/* ---------- biblioteca ---------- */
// "Já tem": Sim e Família Steam contam como sim. Jogo que o Ric já tem não mostra preço.
const jaTem = j => j.adquirido === "Sim" || j.adquirido === "Família Steam";
const precoDe = j => (jaTem(j) ? null : j.promo ?? j.preco ?? j.precoSteam ?? null);
const anoDe = j => Number((j.lancamento || "").match(/\d{4}/)?.[0]) || null;
const votacaoDe = j => [j.opcao && "Série", j.entreLives && "Jogo curto", j.frequente && "Frequente"].filter(Boolean).join(" e ") || null;

const COLUNAS = [
  { chave: "nome", titulo: "Jogo", valor: j => j.nome },
  { chave: "generos", titulo: "Gêneros", valor: j => j.generos?.[0] || null },
  { chave: "ano", titulo: "Lançamento", valor: anoDe },
  { chave: "jaTem", titulo: "Já tem", valor: j => (jaTem(j) ? "Sim" : "Não") },
  { chave: "preco", titulo: "Preço", num: true, valor: precoDe },
  { chave: "votacao", titulo: "Na votação", valor: votacaoDe }
];
const FILTROS = {
  "Todos": () => true,
  "Séries na votação": j => j.opcao,
  "Jogos curtos na votação": j => j.entreLives,
  "Frequentes": j => j.frequente,
  "Já tem": jaTem,
  "Não tem": j => !jaTem(j)
};
const tabela = { busca: "", filtro: "Todos", ordem: "nome", dir: 1 };
const real = v => v == null ? "" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function montarCabecalho() {
  const tr = $("cabecalho");
  tr.replaceChildren();
  COLUNAS.forEach(c => {
    const th = el("th", c.num ? "num" : "", c.titulo);
    if (tabela.ordem === c.chave) th.append(el("span", "seta", tabela.dir > 0 ? "↑" : "↓"));
    th.onclick = () => { tabela.dir = tabela.ordem === c.chave ? -tabela.dir : 1; tabela.ordem = c.chave; montarCabecalho(); renderTabela(); };
    tr.append(th);
  });
}
function montarFiltros() {
  const box = $("filtros");
  box.replaceChildren();
  Object.keys(FILTROS).forEach(s => {
    const b = el("button", "filtro", s);
    b.setAttribute("aria-pressed", String(tabela.filtro === s));
    b.onclick = () => { tabela.filtro = s; montarFiltros(); renderTabela(); };
    box.append(b);
  });
}
function renderTabela() {
  const corpo = $("linhas");
  const termo = tabela.busca.toLowerCase();
  const lista = estado.biblioteca.filter(j => (!termo || j.nome.toLowerCase().includes(termo)) && FILTROS[tabela.filtro](j));
  const valor = COLUNAS.find(c => c.chave === tabela.ordem).valor;
  lista.sort((a, b) => {
    const va = valor(a), vb = valor(b);
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    return (typeof va === "string" ? va.localeCompare(vb) : va - vb) * tabela.dir;
  });
  corpo.replaceChildren();
  if (!lista.length) { const tr = el("tr"); const td = el("td", "vazio-tabela", "Nenhum jogo com esse filtro."); td.colSpan = COLUNAS.length; tr.append(td); corpo.append(tr); }
  lista.forEach(j => {
    const tr = el("tr");
    const nome = el("td"); const cel = el("div", "cel-nome"); cel.append(capa(j.capa, j.nome), el("span", null, j.nome)); nome.append(cel);
    const gen = el("td"); const props = el("div", "props"); (j.generos || []).slice(0, 2).forEach(g => props.append(pilula(g, "roxo"))); gen.append(props);
    const ano = el("td", "muted", anoDe(j) || "");
    const tem = el("td"); tem.append(pilula(jaTem(j) ? "Sim" : "Não", jaTem(j) ? "verde" : "cinza"));
    const preco = el("td", "num");
    if (!jaTem(j)) {
      const p = precoDe(j);
      if (p != null) preco.append(el("span", null, real(p)));
      // em promoção: mostra o preço de antes riscado
      if (j.promo != null && j.preco != null && j.promo < j.preco) preco.append(el("s", "antes", real(j.preco)));
    }
    const vot = el("td"); if (votacaoDe(j)) vot.append(pilula(votacaoDe(j), "roxo"));
    tr.append(nome, gen, ano, tem, preco, vot);
    corpo.append(tr);
  });
  $("contagem").textContent = `${lista.length} de ${estado.biblioteca.length} jogos`;
}

/* ---------- ao vivo ---------- */
const temRanking = !!$("ranking"), temBiblioteca = !!$("linhas");
let assinatura = "";
function renderTudo() {
  if (temRanking) { renderRanking(); renderLateral(); }
  const selo = $("selo");
  if (selo) { selo.classList.toggle("aovivo", !!estado.aoVivo); $("seloTxt").textContent = estado.aoVivo ? "Contando ao vivo" : "Votação aberta"; }
  // galeria, sinopses e tabela só redesenham quando algo muda nelas
  const nova = JSON.stringify([estado.opcoes.map(j => [j.id, j.capa, j.fundo, j.sinopse, j.votos, j.metaVotos]), estado.biblioteca.map(j => [j.id, j.nome, j.opcao, j.entreLives, j.frequente, j.adquirido, j.capa, j.preco, j.promo, j.precoSteam, j.generos, j.lancamento])]);
  if (nova !== assinatura) {
    assinatura = nova;
    if ($("cards")) renderGaleria();
    if ($("listaSinopses")) renderSinopses();
    if (temBiblioteca) renderTabela();
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

if (temBiblioteca) {
  montarCabecalho();
  montarFiltros();
  $("busca").addEventListener("input", e => { tabela.busca = e.target.value; renderTabela(); });
}
addEventListener("scroll", () => $("nav").classList.toggle("rolou", scrollY > 8), { passive: true });
