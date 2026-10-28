// Busca capa, sinopse em português e informações na loja da Steam (sem chave).
import { ler, gravar } from "./store.js";

const CACHE = "steam-cache.json";
const VALIDADE = 7 * 24 * 60 * 60 * 1000; // 7 dias
let cache = ler(CACHE, { busca: {}, detalhes: {} });

// IDs conferidos para os jogos que já estão na votação
export const IDS_CONHECIDOS = {
  "red dead redemption 2": "1174180",
  "horizon zero dawn": "1151640",
  "the last of us part ii": "2531310",
  "the witcher 1": "20900",
  "assassins creed black flag": "242050"
};

export function normalizar(t) {
  return (t || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[™®©'’]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function limparHtml(t) {
  return (t || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ").trim();
}

async function getJson(url) {
  const r = await fetch(url, { headers: { "Accept-Language": "pt-BR" } });
  if (!r.ok) throw new Error(`Steam respondeu ${r.status}`);
  return r.json();
}

function parecido(a, b) {
  const pa = new Set(normalizar(a).split(" ")), pb = new Set(normalizar(b).split(" "));
  let comum = 0; pa.forEach(p => { if (pb.has(p)) comum++; });
  return comum / Math.max(pa.size, 1);
}

export async function acharAppId(nome) {
  const chave = normalizar(nome);
  if (IDS_CONHECIDOS[chave]) return IDS_CONHECIDOS[chave];
  const c = cache.busca[chave];
  if (c && Date.now() - c.t < VALIDADE) return c.id;
  const d = await getJson(`https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(nome)}&l=brazilian&cc=BR`);
  const itens = d.items || [];
  let melhor = null, nota = -1;
  itens.forEach((it, i) => {
    const s = parecido(nome, it.name) - i * 0.02;
    if (s > nota) { nota = s; melhor = it; }
  });
  const id = melhor && nota >= 0.4 ? String(melhor.id) : null;
  cache.busca[chave] = { id, t: Date.now() };
  gravar(CACHE, cache);
  return id;
}

export async function detalhes(appId) {
  if (!appId) return null;
  const c = cache.detalhes[appId];
  // cache de antes da meta não tinha o preço: busca de novo
  if (c && Date.now() - c.t < VALIDADE && (!c.d || "precoCheio" in c.d)) return c.d;
  const d = await getJson(`https://store.steampowered.com/api/appdetails?appids=${appId}&l=brazilian&cc=BR`);
  const info = d?.[appId]?.success ? d[appId].data : null;
  const out = info ? {
    appId: String(appId),
    nomeSteam: info.name,
    sinopse: limparHtml(info.short_description),
    capa: info.header_image,
    capaVertical: `https://shared.steamstatic.com/store_item_assets/steam/apps/${appId}/library_600x900.jpg`,
    fundo: info.screenshots?.[0]?.path_full || info.background_raw || info.header_image,
    generos: (info.genres || []).map(g => g.description).slice(0, 3),
    lancamento: info.release_date?.date || null,
    desenvolvedora: (info.developers || [])[0] || null,
    // preço cheio em reais (sem promoção), base da meta; 0 = grátis, null = sem preço na loja
    precoCheio: info.is_free ? 0 : (info.price_overview?.initial != null ? info.price_overview.initial / 100 : null),
    lojaUrl: `https://store.steampowered.com/app/${appId}`
  } : null;
  cache.detalhes[appId] = { d: out, t: Date.now() };
  gravar(CACHE, cache);
  return out;
}

export function limparCache(appIdOuNome) {
  delete cache.detalhes[appIdOuNome];
  delete cache.busca[normalizar(appIdOuNome)];
  gravar(CACHE, cache);
}
