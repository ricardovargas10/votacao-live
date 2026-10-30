// Votação do próximo jogo · Ric Gameplays
// Rode com:  npm start   (ou dois cliques em iniciar.bat)
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { ler, gravar, gravarAgora, gravarPendentes } from "./lib/store.js";
import { buscarJogos } from "./lib/notion.js";
import { acharAppId, detalhes, limparCache, normalizar } from "./lib/steam.js";
import { criarTwitch, PREFIXO, PREFIXO_ENTRE, tituloRecompensa } from "./lib/twitch.js";
import { criarPublicador } from "./lib/publico.js";
import { EXTRAS } from "./lib/extras.js";

const PORTA = Number(process.env.PORTA || 3000);
const BASE = `http://localhost:${PORTA}`;
const HOSTS_ACEITOS = new Set([`localhost:${PORTA}`, `127.0.0.1:${PORTA}`]);
const PUBLICO = path.join(import.meta.dirname, "public");
// o admin fica fora de public/: só este servidor (no PC do Ric) entrega a página; a Vercel nem tem o arquivo
const ADMIN_HTML = path.join(import.meta.dirname, "privado", "admin.html");
const DATABASE_PADRAO = "40218ed4dd2a801d9f3df813afb0342f"; // Ideias de jogos

/* ---------- dados ---------- */
let conta = ler("conta.json", { notion: { databaseId: DATABASE_PADRAO }, steamManual: {} });
conta.notion = conta.notion || { databaseId: DATABASE_PADRAO };
conta.steamManual = conta.steamManual || {};
conta.supabase = conta.supabase || {};
const salvarConta = () => gravarAgora("conta.json", conta);
const publicador = criarPublicador(() => conta.supabase);

let votacao = ler("votos.json", { votos: {}, ultimos: [], vistos: [] });
votacao.vistos = votacao.vistos || [];
votacao.votosEntre = votacao.votosEntre || {};
votacao.ultimosEntre = votacao.ultimosEntre || [];

// Duas votações: Séries (jogos longos, "É opção?" no Notion) e Jogos (rápidos, entre lives, "Jogo curto?")
// prefixosAntigos: nomes que as recompensas já tiveram, para ainda reconhecer resgates feitos com eles
const LISTAS = {
  // cada lista tem uma meta só em votos, igual para todos os jogos dela (ajustável no admin)
  principal: { campo: "opcao", votos: "votos", ultimos: "ultimos", zerado: "zeradoEm", prefixo: PREFIXO, prefixosAntigos: ["Voto: "], chave: id => id, custo: () => conta.twitch.custo || 250, metaFixaVotos: () => conta.twitch.metaSeries || 40, prompt: "Seu voto soma pontos para a próxima série." },
  entre: { campo: "entreLives", votos: "votosEntre", ultimos: "ultimosEntre", zerado: "zeradoEmEntre", prefixo: PREFIXO_ENTRE, prefixosAntigos: ["Entre lives: "], chave: id => "entre:" + id, custo: () => conta.twitch.custoEntre || 100, metaFixaVotos: () => conta.twitch.metaCurtos || 20, prompt: "Seu voto soma pontos para o próximo jogo entre lives." }
};
const nomeLista = l => (LISTAS[l] ? l : "principal");

// Meta de cada jogo: a mesma quantidade de votos para todos os jogos da lista
function metaDoJogo(j, lista) {
  const L = LISTAS[lista];
  const v = L.metaFixaVotos();
  return { metaPontos: v * L.custo(), metaVotos: v };
}
// Fila de quem bateu a meta, por votação: a ordem de chegada não muda mais, mesmo que outro jogo
// passe em votos depois. Sai da fila só quem voltar a ficar abaixo da meta (zerar, ajuste manual, meta maior).
votacao.batidas = votacao.batidas || {};
const filaDe = lista => (votacao.batidas[lista] = votacao.batidas[lista] || []);
function posicaoNaFila(id, lista) {
  const i = filaDe(lista).indexOf(id);
  return i < 0 ? null : i;
}
// devolve true se a fila mudou (aí as recompensas precisam ser revistas)
function atualizarFilas() {
  let mudou = false;
  for (const [lista, L] of Object.entries(LISTAS)) {
    const meta = L.metaFixaVotos(), votos = votacao[L.votos];
    const fila = filaDe(lista).filter(id => (votos[id] || 0) >= meta);
    const novos = Object.keys(votos).filter(id => votos[id] >= meta && !fila.includes(id)).sort((a, b) => votos[b] - votos[a]);
    if (novos.length || fila.length !== filaDe(lista).length) mudou = true;
    votacao.batidas[lista] = [...fila, ...novos];
  }
  return mudou;
}

// cada voto vai para o disco na hora: fechar a janela no X não perde nada
const salvarVotos = () => gravarAgora("votos.json", votacao);

let jogos = ler("jogos.json", null) || ler("../exemplo/jogos-exemplo.json", []);
const fonte = { origem: conta.notion.token ? "notion" : "exemplo", ultimaSync: null, erro: null };
let steamInfo = {}; // id da página -> dados da Steam

/* ---------- estado enviado para as telas ---------- */
function jogoPublico(j, lista = "principal") {
  // dados da Steam; para jogos fora da Steam (Valorant, Hytale...), os guardados em lib/extras.js
  const s = { ...EXTRAS[normalizar(j.nome)], ...steamInfo[j.id] };
  if (!s.generos?.length) s.generos = EXTRAS[normalizar(j.nome)]?.generos;
  return {
    id: j.id, nome: j.nome, opcao: j.opcao, entreLives: !!j.entreLives, frequente: !!j.frequente,
    status: j.status, tipo: j.tipo, plataforma: j.plataforma, adquirido: j.adquirido,
    frequencia: j.frequencia, preco: j.preco, promo: j.promo,
    votos: votacao[LISTAS[lista].votos][j.id] || 0,
    ...metaDoJogo(j, lista),
    ordemMeta: posicaoNaFila(j.id, lista),
    precoSteam: steamInfo[j.id]?.precoCheio ?? null,
    capa: j.capaNotion || s.capa || null,
    capaVertical: s.capaVertical || null,
    fundo: s.fundo || null,
    sinopse: j.sinopseNotion || s.sinopse || null,
    generos: s.generos || [],
    lancamento: s.lancamento || null,
    desenvolvedora: s.desenvolvedora || null,
    lojaUrl: s.lojaUrl || null,
    lojaNome: s.lojaNome || "Ver na Steam"
  };
}
function estadoPublico() {
  const todos = jogos.map(j => jogoPublico(j));
  const opcoes = todos.filter(j => j.opcao);
  const entre = jogos.filter(j => j.entreLives).map(j => jogoPublico(j, "entre"));
  return {
    opcoes,
    biblioteca: todos,
    total: opcoes.reduce((a, j) => a + j.votos, 0),
    ultimos: votacao.ultimos,
    custo: conta.twitch?.custo || null,
    // votação entre lives: as telas abertas com ?lista=entre usam este bloco
    entre: { opcoes: entre, total: entre.reduce((a, j) => a + j.votos, 0), ultimos: votacao.ultimosEntre, custo: LISTAS.entre.custo() },
    // Frequentes (Frequência "Fixo"): só para mostrar, sem votação
    frequentes: todos.filter(j => j.frequente),
    aoVivo: twitch.status().conectado
  };
}

/* ---------- atualizações ao vivo (SSE) ---------- */
const clientes = new Set();
function enviar(evento, dados) {
  const msg = `event: ${evento}\ndata: ${JSON.stringify(dados)}\n\n`;
  clientes.forEach(res => res.write(msg));
}
let estadoTimer;
function avisarEstado() {
  clearTimeout(estadoTimer);
  estadoTimer = setTimeout(() => { const s = estadoPublico(); enviar("estado", s); publicarEstado(s); }, 80);
}

// Site público: o placar (pequeno, muda a cada voto) e a biblioteca (grande, muda pouco) vão em linhas separadas
let assinaturaBiblioteca = "";
function publicarEstado(s) {
  const { biblioteca, ...placar } = s;
  publicador.publicar("placar", placar);
  const assinatura = JSON.stringify(biblioteca);
  if (assinatura !== assinaturaBiblioteca) { assinaturaBiblioteca = assinatura; publicador.publicar("biblioteca", biblioteca); }
}
setInterval(() => clientes.forEach(res => res.write(": ping\n\n")), 25000);

/* ---------- votos ---------- */
function registrarVoto(jogoId, quem, lista = "principal") {
  const L = LISTAS[lista];
  const j = jogos.find(x => x.id === jogoId && x[L.campo]);
  if (!j) return false;
  const votos = votacao[L.votos];
  votos[j.id] = (votos[j.id] || 0) + 1;
  votacao[L.ultimos] = [{ quem, jogoId: j.id, jogo: j.nome, t: Date.now() }, ...votacao[L.ultimos]].slice(0, 12);
  const bateuMeta = atualizarFilas();
  salvarVotos();
  if (bateuMeta) atualizarRecompensasSozinho(); // desliga a recompensa de quem bateu a meta
  const total = jogos.filter(x => x[L.campo]).reduce((a, x) => a + (votos[x.id] || 0), 0);
  enviar("voto", { lista, jogoId: j.id, jogo: j.nome, quem, votos: votos[j.id], total, t: Date.now() });
  avisarEstado();
  return true;
}

/* ---------- Twitch ---------- */
conta.twitch = conta.twitch || {};
const twitch = criarTwitch({
  getConta: () => conta.twitch,
  salvarConta: c => { conta.twitch = c; salvarConta(); },
  aoMudarStatus: () => avisarEstado(),
  aoResgatar: r => processarResgate(r),
  aoConectar: () => { recuperarResgates(); atualizarRecompensasSozinho(); }
});

function processarResgate({ id, quem, rewardId, titulo, t }) {
  // o mesmo resgate pode chegar duas vezes (reconexão ou recuperação): conta uma só
  if (votacao.vistos.includes(id)) return;
  // de qual votação é: pela recompensa criada aqui ou, se foi feita à mão, pelo começo do título
  let chave = conta.twitch.recompensas?.[rewardId];
  let lista = "principal", jogoId = null;
  if (chave) {
    if (chave.startsWith("entre:")) { lista = "entre"; jogoId = chave.slice(6); } else jogoId = chave;
  } else {
    let prefixo;
    const [nome, L] = Object.entries(LISTAS).find(([, L]) => (prefixo = [L.prefixo, ...L.prefixosAntigos].find(p => titulo.startsWith(p)))) || [];
    if (L) {
      lista = nome;
      const alvo = normalizar(titulo.slice(prefixo.length));
      jogoId = jogos.find(j => tituloBate(j.nome, alvo))?.id;
    }
  }
  const zerado = votacao[LISTAS[lista].zerado];
  if (zerado && t && t < zerado) return; // resgate de antes de zerar
  votacao.vistos = [...votacao.vistos, id].slice(-5000);
  if (jogoId) registrarVoto(jogoId, quem, lista); else salvarVotos();
}
// o título da recompensa pode ter sido cortado em 45 caracteres
function tituloBate(nome, alvo) {
  const n = normalizar(nome);
  return n === alvo || (alvo.length >= 20 && n.startsWith(alvo));
}

// votos feitos enquanto o programa estava fechado ou sem internet
async function recuperarResgates() {
  try {
    const lista = await twitch.resgatesRecentes();
    const antes = votacao.vistos.length;
    lista.forEach(processarResgate);
    const novos = votacao.vistos.length - antes;
    if (novos) console.log(`  ${novos} voto(s) feitos com o programa fechado foram recuperados.`);
  } catch (e) {
    console.error("Não deu para recuperar votos antigos:", e.message);
  }
}

/* ---------- Notion + Steam ---------- */
const chaveOpcoes = lista => lista.filter(j => j.opcao || j.entreLives).map(j => `${j.id}:${j.nome}:${!!j.opcao}:${!!j.entreLives}`).sort().join("|");

// as recompensas que precisam existir na Twitch agora, das duas votações
function itensRecompensa() {
  // quem bateu a meta não tem mais recompensa: a vaga já está garantida
  return Object.entries(LISTAS).flatMap(([lista, L]) => jogos.filter(j => j[L.campo] && posicaoNaFila(j.id, lista) === null).map(j => ({
    chave: L.chave(j.id), titulo: tituloRecompensa(j.nome, L.prefixo), custo: L.custo(), prompt: L.prompt
  })));
}

async function sincronizarNotion() {
  if (!conta.notion.token) { fonte.origem = "exemplo"; return; }
  try {
    const antes = chaveOpcoes(jogos);
    jogos = await buscarJogos({ token: conta.notion.token, databaseId: conta.notion.databaseId || DATABASE_PADRAO });
    gravar("jogos.json", jogos);
    Object.assign(fonte, { origem: "notion", ultimaSync: Date.now(), erro: null });
    avisarEstado();
    completarSteam();
    if (chaveOpcoes(jogos) !== antes) atualizarRecompensasSozinho();
  } catch (e) {
    Object.assign(fonte, { erro: e.message });
  }
}

// Marcou ou desmarcou "É opção?" no Notion: liga ou desliga a recompensa na Twitch sozinho.
// Os votos do jogo desmarcado ficam guardados e voltam se ele entrar de novo na votação.
let atualizandoRecompensas = null;
function atualizarRecompensasSozinho() {
  if (!conta.twitch.custo || !twitch.status().conectado) return;
  atualizandoRecompensas = (atualizandoRecompensas || Promise.resolve())
    .then(() => twitch.sincronizarRecompensas(itensRecompensa()))
    .then(rel => rel.forEach(x => console.log(`  Recompensa ${x.ok ? "" : "(erro) "}${x.jogo}: ${x.acao}`)))
    .catch(e => console.error("Não deu para atualizar as recompensas:", e.message))
    .finally(() => avisarEstado());
}

let completando = false;
async function completarSteam() {
  if (completando) return;
  completando = true;
  // jogos da votação primeiro
  const fila = [...jogos].sort((a, b) => Number(b.opcao || b.entreLives) - Number(a.opcao || a.entreLives));
  for (const j of fila) {
    try {
      const appId = conta.steamManual[j.id] || j.steamIdNotion || await acharAppId(j.nome);
      const d = await detalhes(appId);
      if (d) { steamInfo[j.id] = d; avisarEstado(); }
      else delete steamInfo[j.id];
    } catch { /* sem internet ou Steam fora do ar: o site segue sem capa */ }
  }
  completando = false;
}

/* ---------- servidor ---------- */
const TIPOS = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".json": "application/json", ".woff2": "font/woff2", ".webp": "image/webp", ".txt": "text/plain; charset=utf-8" };
const PAGINAS = { "/": "index.html", "/series": "series.html", "/jogos": "jogos.html", "/frequentes": "frequentes.html", "/biblioteca": "biblioteca.html", "/telao": "telao.html", "/overlay": "overlay.html" };

function json(res, codigo, dados) {
  res.writeHead(codigo, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(dados));
}
function lerCorpo(req) {
  return new Promise((resolve, reject) => {
    let b = "";
    req.setEncoding("utf8");
    req.on("data", c => { b += c; if (b.length > 1e5) { reject(new Error("Pedido grande demais")); req.destroy(); } });
    req.on("end", () => {
      try { const d = b ? JSON.parse(b) : {}; resolve(d && typeof d === "object" && !Array.isArray(d) ? d : {}); }
      catch { reject(new Error("JSON inválido")); }
    });
    req.on("error", reject);
  });
}
function ehLocal(req) {
  const ip = req.socket.remoteAddress || "";
  return ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
}
// Host certo barra "DNS rebinding" (site de fora se passando por localhost)
function hostAceito(req) {
  return HOSTS_ACEITOS.has((req.headers.host || "").toLowerCase());
}
// Origin diferente = pedido feito por outro site aberto no navegador
function origemAceita(req) {
  const o = req.headers.origin;
  return o === undefined || o === BASE;
}
function recusar(res, codigo, msg, extra = {}) {
  res.writeHead(codigo, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", ...extra });
  res.end(msg);
}
// Regras das rotas /api/admin/: só POST com JSON (e GET em /api/admin/estado), só vindas do próprio admin
function checarAdmin(req, url) {
  if (!origemAceita(req)) return [403, "Origem recusada"];
  const ehEstado = url.pathname === "/api/admin/estado";
  if (ehEstado && req.method === "GET") return null;
  if (req.method !== "POST") return [405, "Método não permitido", { Allow: ehEstado ? "GET" : "POST" }];
  const tipo = (req.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
  if (tipo !== "application/json") return [415, "Use Content-Type application/json"];
  return null;
}

function estadoAdmin() {
  return {
    twitch: { ...twitch.status(), temClientId: !!conta.twitch.clientId, temSecret: !!conta.twitch.clientSecret, clientId: conta.twitch.clientId || "", custo: conta.twitch.custo || null, custoEntre: LISTAS.entre.custo(), metaSeries: LISTAS.principal.metaFixaVotos(), metaCurtos: LISTAS.entre.metaFixaVotos(), redirect: `${BASE}/auth/callback` },
    notion: { configurado: !!conta.notion.token, databaseId: conta.notion.databaseId || DATABASE_PADRAO, ...fonte },
    supabase: { url: conta.supabase.url || "", temSecreta: !!conta.supabase.secreta, temPublica: !!conta.supabase.publica, ...publicador.status() },
    links: { site: BASE + "/", telao: BASE + "/telao", overlay: BASE + "/overlay", telaoEntre: BASE + "/telao?lista=entre", overlayEntre: BASE + "/overlay?lista=entre" },
    steam: jogos.filter(j => j.opcao || j.entreLives).map(j => ({ id: j.id, nome: j.nome, appId: steamInfo[j.id]?.appId || null, nomeSteam: steamInfo[j.id]?.nomeSteam || null, manual: conta.steamManual[j.id] || null }))
  };
}

async function rotaAdmin(req, res, url) {
  const r = url.pathname.replace("/api/admin/", "");
  try {
    if (r === "estado") return json(res, 200, estadoAdmin());
    let corpo;
    try { corpo = await lerCorpo(req); } catch (e) { return json(res, 400, { erro: e.message }); }
    if (r === "twitch") {
      if (typeof corpo.clientId === "string" && corpo.clientId.trim()) conta.twitch.clientId = corpo.clientId.trim();
      if (typeof corpo.clientSecret === "string" && corpo.clientSecret.trim()) conta.twitch.clientSecret = corpo.clientSecret.trim();
      salvarConta();
      return json(res, 200, estadoAdmin());
    }
    if (r === "twitch/desconectar") { twitch.desconectar(); return json(res, 200, estadoAdmin()); }
    if (r === "notion") {
      if (typeof corpo.token === "string" && corpo.token.trim()) conta.notion.token = corpo.token.trim();
      if (typeof corpo.databaseId === "string" && corpo.databaseId.trim()) {
        // aceita o ID puro ou o link copiado do Notion
        const id = corpo.databaseId.replace(/-/g, "").match(/[0-9a-f]{32}/i)?.[0];
        if (!id) return json(res, 400, { erro: "ID da base inválido" });
        conta.notion.databaseId = id.toLowerCase();
      }
      salvarConta();
      await sincronizarNotion();
      return json(res, 200, estadoAdmin());
    }
    if (r === "supabase") {
      if (typeof corpo.url === "string" && corpo.url.trim()) {
        const u = corpo.url.trim().replace(/\/+$/, "");
        if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(u)) return json(res, 400, { erro: "Cole a Project URL, no formato https://xxxx.supabase.co" });
        conta.supabase.url = u;
      }
      if (typeof corpo.publica === "string" && corpo.publica.trim()) conta.supabase.publica = corpo.publica.trim();
      if (typeof corpo.secreta === "string" && corpo.secreta.trim()) conta.supabase.secreta = corpo.secreta.trim();
      salvarConta();
      // o site público precisa só da URL e da chave pública (feita para ficar no navegador de todo mundo)
      if (conta.supabase.url && conta.supabase.publica) {
        fs.writeFileSync(path.join(PUBLICO, "js", "config-publico.js"),
          `// Gerado pelo admin. Só a URL e a chave PÚBLICA do Supabase: a chave secreta nunca vem para cá.\nexport const SUPABASE_URL = ${JSON.stringify(conta.supabase.url)};\nexport const SUPABASE_CHAVE = ${JSON.stringify(conta.supabase.publica)};\n`);
      }
      assinaturaBiblioteca = ""; avisarEstado(); // manda tudo de novo
      await new Promise(ok => setTimeout(ok, 1500));
      return json(res, 200, estadoAdmin());
    }
    if (r === "notion/sincronizar") { await sincronizarNotion(); return json(res, 200, estadoAdmin()); }
    if (r === "recompensas") {
      const custo = parseInt(corpo.custo, 10);
      if (!custo || custo < 1) return json(res, 400, { erro: "Coloque o custo do voto" });
      const custoEntre = parseInt(corpo.custoEntre, 10);
      if (corpo.custoEntre !== undefined && (!custoEntre || custoEntre < 1)) return json(res, 400, { erro: "Coloque o custo do voto entre lives" });
      conta.twitch.custo = custo;
      if (custoEntre) conta.twitch.custoEntre = custoEntre;
      const metaSeries = parseInt(corpo.metaSeries, 10);
      if (metaSeries >= 1) conta.twitch.metaSeries = metaSeries;
      const metaCurtos = parseInt(corpo.metaCurtos, 10);
      if (metaCurtos >= 1) conta.twitch.metaCurtos = metaCurtos;
      salvarConta();
      atualizarFilas();
      await atualizandoRecompensas; // não roda junto com a atualização automática
      const relatorio = await twitch.sincronizarRecompensas(itensRecompensa());
      avisarEstado();
      return json(res, 200, { relatorio, ...estadoAdmin() });
    }
    const lista = nomeLista(corpo.lista), L = LISTAS[lista];
    if (r === "votos") {
      const j = jogos.find(x => x.id === corpo.id);
      if (!j) return json(res, 404, { erro: "Jogo não encontrado" });
      const atual = votacao[L.votos][j.id] || 0;
      const novo = typeof corpo.valor === "number" ? corpo.valor : atual + (Number(corpo.delta) || 0);
      votacao[L.votos][j.id] = Math.max(0, Math.round(novo) || 0);
      if (atualizarFilas()) atualizarRecompensasSozinho();
      salvarVotos(); avisarEstado();
      return json(res, 200, estadoPublico());
    }
    if (r === "zerar") {
      if (corpo.id) votacao[L.votos][corpo.id] = 0;
      else { votacao[L.votos] = {}; votacao[L.ultimos] = []; votacao[L.zerado] = Date.now(); }
      if (atualizarFilas()) atualizarRecompensasSozinho(); // quem saiu da fila volta a ter recompensa
      salvarVotos(); avisarEstado();
      return json(res, 200, estadoPublico());
    }
    if (r === "simular") {
      const opcoes = jogos.filter(j => j[L.campo]);
      const nomes = ["Dani", "Isa", "Pikachu", "Max", "Kastiel", "Teste"];
      const qtd = Math.max(1, Math.min(30, parseInt(corpo.quantidade, 10) || 1));
      for (let i = 0; i < qtd; i++) {
        setTimeout(() => {
          const j = corpo.id ? opcoes.find(x => x.id === corpo.id) : opcoes[Math.floor(Math.random() * opcoes.length)];
          if (j) registrarVoto(j.id, nomes[Math.floor(Math.random() * nomes.length)] + (qtd > 1 ? "_" + (i + 1) : ""), lista);
        }, i * 120);
      }
      return json(res, 200, { ok: true });
    }
    if (r === "steam") {
      const j = jogos.find(x => x.id === corpo.id);
      if (!j) return json(res, 404, { erro: "Jogo não encontrado" });
      const novo = String(corpo.appId || "").replace(/\D/g, "");
      if (novo) conta.steamManual[j.id] = novo; else delete conta.steamManual[j.id];
      salvarConta();
      limparCache(j.nome);
      delete steamInfo[j.id];
      await completarSteam();
      return json(res, 200, estadoAdmin());
    }
    return json(res, 404, { erro: "Rota não encontrada" });
  } catch (e) {
    return json(res, 500, { erro: e.message });
  }
}

const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, BASE);

  if (url.pathname === "/api/estado") return json(res, 200, estadoPublico());

  if (url.pathname === "/api/ao-vivo") {
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-store", "Connection": "keep-alive" });
    res.write(`event: estado\ndata: ${JSON.stringify(estadoPublico())}\n\n`);
    clientes.add(res);
    req.on("close", () => clientes.delete(res));
    return;
  }

  // tudo de configuração só responde no próprio PC, pelo endereço localhost:3000
  if (url.pathname.startsWith("/api/admin/") || url.pathname.startsWith("/auth/") || url.pathname === "/admin") {
    if (!ehLocal(req) || !hostAceito(req)) return recusar(res, 403, "Acesso só pelo PC do Ric, em " + BASE);
  }
  if (url.pathname.startsWith("/api/admin/")) {
    const erro = checarAdmin(req, url);
    if (erro) return recusar(res, ...erro);
    return rotaAdmin(req, res, url);
  }
  if (url.pathname.startsWith("/auth/") && req.method !== "GET") return recusar(res, 405, "Método não permitido", { Allow: "GET" });
  // o admin só aceita pedidos vindos de http://localhost:3000, então abre sempre por esse endereço
  if (url.pathname === "/admin" && req.headers.host !== `localhost:${PORTA}`) { res.writeHead(302, { Location: BASE + "/admin" }); return res.end(); }

  if (url.pathname === "/auth/twitch") {
    if (!conta.twitch.clientId || !conta.twitch.clientSecret) { res.writeHead(302, { Location: "/admin?erro=faltam-chaves" }); return res.end(); }
    res.writeHead(302, { Location: twitch.authUrl(`${BASE}/auth/callback`) });
    return res.end();
  }
  if (url.pathname === "/auth/callback") {
    const code = url.searchParams.get("code");
    try {
      if (!code) throw new Error(url.searchParams.get("error_description") || "Autorização cancelada");
      await twitch.trocarCodigo(code, `${BASE}/auth/callback`, url.searchParams.get("state"));
      res.writeHead(302, { Location: "/admin?twitch=ok" });
    } catch (e) {
      res.writeHead(302, { Location: "/admin?erro=" + encodeURIComponent(e.message) });
    }
    return res.end();
  }

  // arquivos do site
  const arquivo = PAGINAS[url.pathname] || url.pathname.slice(1);
  const caminho = url.pathname === "/admin" ? ADMIN_HTML : path.resolve(PUBLICO, arquivo);
  if (caminho !== ADMIN_HTML && !caminho.startsWith(PUBLICO + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(caminho, (err, dados) => {
    if (err) { res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }); return res.end("Página não encontrada"); }
    res.writeHead(200, { "Content-Type": TIPOS[path.extname(caminho)] || "application/octet-stream", "Cache-Control": "no-cache" });
    res.end(dados);
  });
});

servidor.listen(PORTA, "127.0.0.1", async () => {
  console.log("");
  console.log("  Votação do próximo jogo rodando");
  console.log(`  Site:     ${BASE}/`);
  console.log(`  Telão:    ${BASE}/telao`);
  console.log(`  Overlay:  ${BASE}/overlay`);
  console.log(`  Entre lives:  ${BASE}/overlay?lista=entre   (telão: ${BASE}/telao?lista=entre)`);
  console.log(`  Admin:    ${BASE}/admin`);
  console.log("");
  console.log("  Deixe esta janela aberta durante a live.");
  atualizarFilas();
  abrirAdmin(); // só agora, com o servidor já respondendo (antes o navegador chegava cedo e dava "conexão recusada")
  await sincronizarNotion();
  completarSteam();
  twitch.iniciar();
  setInterval(sincronizarNotion, 2 * 60 * 1000); // mudanças no Notion aparecem em até 2 minutos
});

// Ctrl+C, fechar a janela no X (SIGHUP) e desligar o PC: grava tudo antes de sair
function sair() {
  try { gravarAgora("votos.json", votacao); } catch {}
  gravarPendentes();
  process.exit(0);
}
["SIGINT", "SIGHUP", "SIGBREAK", "SIGTERM"].forEach(s => process.on(s, sair));
process.on("uncaughtException", e => console.error("Erro:", e.message));
process.on("unhandledRejection", e => console.error("Erro:", e?.message || e));
// o atalho (iniciar.bat) liga ABRIR_ADMIN para o admin abrir no navegador quando tudo estiver pronto
function abrirAdmin() {
  if (process.env.ABRIR_ADMIN !== "1") return;
  try { spawn("cmd", ["/c", "start", "", `${BASE}/admin`], { detached: true, stdio: "ignore" }).unref(); } catch {}
}
servidor.on("error", e => {
  if (e.code === "EADDRINUSE") {
    console.error(`\n  A votação já está aberta em outra janela. Abrindo o admin dela.\n`);
    abrirAdmin();
  } else console.error("Erro:", e.message);
  setTimeout(() => process.exit(1), 500); // meio segundo para o navegador abrir
});
