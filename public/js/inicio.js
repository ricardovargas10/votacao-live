// Página inicial: mostra quem está na frente em cada votação e leva para as páginas de Séries e Jogos.
import { conectar, ordenar, capa, porcentagemMeta } from "./ao-vivo.js";

const $ = id => document.getElementById(id);

function caixa(capaId, infoId, bloco, vazio) {
  const ordem = ordenar(bloco?.opcoes || []);
  const [a] = ordem;
  const info = $(infoId);
  if (!ordem.length) info.textContent = vazio;
  else if (!a.votos) info.textContent = `${ordem.length} na votação · nenhum voto ainda`;
  else info.textContent = `Na frente: ${a.nome} · ${porcentagemMeta(a)}% da meta · ${bloco.total} votos no total`;
  // capa de quem está na frente (ou do primeiro da lista)
  const box = $(capaId);
  const chave = a ? a.id + "|" + (a.capa || "") : "";
  if (box.dataset.chave !== chave) {
    const nova = a ? capa(a.capa, a.nome, "capa caixa-capa") : Object.assign(document.createElement("div"), { className: "capa caixa-capa" });
    nova.id = capaId; nova.dataset.chave = chave;
    box.replaceWith(nova);
  }
}

conectar({
  aoEstado: s => {
    caixa("capaSeries", "infoSeries", s, "Nenhuma série na votação agora.");
    caixa("capaJogos", "infoJogos", s.entre, "Nenhum jogo na votação agora.");
    $("selo").classList.toggle("aovivo", !!s.aoVivo);
    $("seloTxt").textContent = s.aoVivo ? "Contando ao vivo" : "Votação aberta";
  }
});
addEventListener("scroll", () => $("nav").classList.toggle("rolou", scrollY > 8), { passive: true });
