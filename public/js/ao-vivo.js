// Qual votação esta tela mostra: a principal ou a entre lives (endereço com ?lista=entre)
export const LISTA = new URLSearchParams(location.search).get("lista") === "entre" ? "entre" : "principal";

// No PC do Ric as telas falam direto com o servidor; no site público (Vercel) leem a cópia do Supabase
export const LOCAL = ["localhost", "127.0.0.1"].includes(location.hostname);
const daLista = s => (LISTA === "entre" && s.entre ? { ...s, ...s.entre } : s);

// Recebe o estado da votação e cada voto na hora em que acontece.
// Com ?lista=entre, a tela recebe os dados da votação entre lives no lugar da principal.
export function conectar({ aoEstado, aoVoto }) {
  if (!LOCAL) return conectarPublico({ aoEstado, aoVoto });
  const fonte = new EventSource("/api/ao-vivo");
  fonte.addEventListener("estado", e => aoEstado?.(daLista(JSON.parse(e.data))));
  fonte.addEventListener("voto", e => {
    const v = JSON.parse(e.data);
    if ((v.lista || "principal") === LISTA) aoVoto?.(v);
  });
  return fonte;
}

async function conectarPublico({ aoEstado, aoVoto }) {
  const { SUPABASE_URL, SUPABASE_CHAVE } = await import("/js/config-publico.js");
  const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm");
  const sb = createClient(SUPABASE_URL, SUPABASE_CHAVE);
  const linhas = {};
  const ultimoVisto = { principal: 0, entre: 0 };

  // votos novos = nomes novos em "últimos votos"; viram a roleta de nomes como no PC
  function votosNovos(placar, primeira) {
    for (const lista of ["principal", "entre"]) {
      const bloco = lista === "entre" ? placar.entre : placar;
      const ult = bloco?.ultimos || [];
      if (!primeira && lista === LISTA) {
        ult.filter(u => u.t > ultimoVisto[lista]).reverse().forEach(u => {
          const j = bloco.opcoes.find(o => o.id === u.jogoId);
          if (j) aoVoto?.({ lista, jogoId: u.jogoId, jogo: u.jogo, quem: u.quem, votos: j.votos, t: u.t });
        });
      }
      ultimoVisto[lista] = Math.max(ultimoVisto[lista], ...ult.map(u => u.t), 0);
    }
  }
  function aplicar(id, dados, primeira) {
    linhas[id] = dados;
    if (id === "placar") votosNovos(dados, primeira);
    if (linhas.placar) aoEstado?.(daLista({ ...linhas.placar, biblioteca: linhas.biblioteca || [] }));
  }

  const { data } = await sb.from("estado").select("id,dados");
  (data || []).sort((a, b) => (a.id === "placar") - (b.id === "placar")).forEach(r => aplicar(r.id, r.dados, true));
  sb.channel("estado")
    .on("postgres_changes", { event: "*", schema: "public", table: "estado" }, p => p.new?.id && aplicar(p.new.id, p.new.dados, false))
    .subscribe();
  return sb;
}

// textos que mudam entre as duas votações
export const TEXTOS = LISTA === "entre"
  ? { titulo: "Entre lives", pergunta: "Qual o jogo entre lives?", chip: "Entre lives: nome do jogo" }
  : { titulo: "Próximo jogo", pergunta: "Qual o próximo jogo?", chip: "Voto: nome do jogo" };


export function ordenar(opcoes) {
  return [...opcoes].sort((a, b) => b.votos - a.votos || a.nome.localeCompare(b.nome));
}

export function el(tag, cls, texto) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (texto != null) e.textContent = texto;
  return e;
}

export function iniciais(nome) {
  return (nome || "?").replace(/[^A-Za-zÀ-ú0-9 ]/g, "").split(" ").filter(Boolean).slice(0, 2).map(p => p[0]).join("").toUpperCase();
}

// imagem com reserva: se a capa não carregar, mostra as iniciais
export function capa(url, nome, cls = "capa") {
  const box = el("div", cls);
  const reserva = el("span", "capa-reserva", iniciais(nome));
  box.appendChild(reserva);
  if (url) {
    const img = new Image();
    img.alt = "";
    img.loading = "lazy";
    img.onload = () => box.classList.add("carregada");
    img.onerror = () => img.remove();
    img.src = url;
    box.appendChild(img);
  }
  return box;
}

export const CORES_STATUS = {
  "Pensando": "cinza", "Quero jogar": "laranja", "Jogando": "azul", "Joguei no off": "vermelho", "Feito": "verde"
};
