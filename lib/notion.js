// Lê a base "Ideias de jogos" do Notion.
const VERSAO = "2025-09-03";

function texto(prop) {
  if (!prop) return "";
  const partes = prop.title || prop.rich_text || [];
  return partes.map(p => p.plain_text).join("").trim();
}
function selecao(prop) {
  if (!prop) return null;
  return prop.select?.name || prop.status?.name || null;
}
function numero(prop) {
  return prop && typeof prop.number === "number" ? prop.number : null;
}
function arquivoUrl(prop) {
  if (!prop) return null;
  if (prop.url) return prop.url;
  const f = prop.files?.[0];
  return f ? (f.external?.url || f.file?.url || null) : null;
}
function capaDaPagina(p) {
  const c = p.cover;
  return c ? (c.external?.url || c.file?.url || null) : null;
}

export function mapearPagina(p) {
  const pr = p.properties || {};
  const steamProp = pr["Steam ID"];
  const steamId = steamProp
    ? (typeof steamProp.number === "number" ? String(steamProp.number) : texto(steamProp) || null)
    : null;
  return {
    id: p.id.replace(/-/g, ""),
    nome: texto(pr["Nome"]),
    opcao: pr["É opção?"]?.checkbox === true,
    entreLives: pr["Entre lives?"]?.checkbox === true,
    status: selecao(pr["Status"]),
    tipo: selecao(pr["Tipo"]),
    plataforma: selecao(pr["Plataforma"]),
    adquirido: selecao(pr["Adquirido?"]),
    frequencia: selecao(pr["Frequência"]),
    preco: numero(pr["Preço"]),
    promo: numero(pr["Promo"]),
    chicoPoints: numero(pr["ChicoPoints"]),
    // colunas opcionais: se você criar no Notion, o site usa
    sinopseNotion: texto(pr["Sinopse"]) || null,
    capaNotion: arquivoUrl(pr["Capa"]) || capaDaPagina(p),
    steamIdNotion: steamId,
    url: p.url
  };
}

async function notion(token, caminho, corpo) {
  const r = await fetch("https://api.notion.com/v1" + caminho, {
    method: corpo ? "POST" : "GET",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Notion-Version": VERSAO,
      "Content-Type": "application/json"
    },
    body: corpo ? JSON.stringify(corpo) : undefined
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error(r.status === 404
      ? "Base não encontrada. Ligue a integração na página @ric_chico (três pontinhos > Conexões)."
      : d.message || `Notion respondeu ${r.status}`);
    e.status = r.status;
    throw e;
  }
  return d;
}

// Desde a versão 2025-09-03 a base ("database") guarda uma ou mais fontes de dados
// ("data sources"), e a consulta é feita na fonte. O ID salvo pode ser de qualquer uma das duas.
async function acharFonte(token, id) {
  try {
    const base = await notion(token, `/databases/${id}`);
    const fonte = base.data_sources?.[0];
    if (!fonte) throw new Error("A base não tem fonte de dados");
    return fonte.id;
  } catch (e) {
    if (e.status !== 404 && e.status !== 400) throw e;
    await notion(token, `/data_sources/${id}`); // talvez o ID já seja da fonte de dados
    return id;
  }
}

export async function buscarJogos({ token, databaseId }) {
  const fonte = await acharFonte(token, databaseId);
  const jogos = [];
  let cursor;
  do {
    const d = await notion(token, `/data_sources/${fonte}/query`, cursor ? { start_cursor: cursor, page_size: 100 } : { page_size: 100 });
    d.results.forEach(p => { if (p.object !== "page") return; const j = mapearPagina(p); if (j.nome) jogos.push(j); });
    cursor = d.has_more ? d.next_cursor : null;
  } while (cursor);
  return jogos;
}
