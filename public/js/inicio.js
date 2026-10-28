// Página inicial: mostra quem está na frente em cada votação e leva para as páginas de Séries e Jogos.
import { conectar, ordenar, capa, porcentagemMeta, el } from "./ao-vivo.js";

const $ = id => document.getElementById(id);

function caixa(capaId, infoId, bloco, vazio) {
  const ordem = ordenar(bloco?.opcoes || []);
  const [a] = ordem;
  const info = $(infoId);
  if (!ordem.length) info.textContent = vazio;
  else if (!a.votos) info.textContent = `${ordem.length} na votação · nenhum voto ainda`;
  else info.textContent = `Na frente: ${a.nome} · ${porcentagemMeta(a)}% da meta · ${bloco.total} votos no total`;
  // capa de quem está na frente; sem votos, a do primeiro que tiver capa
  const box = $(capaId);
  const c = a && a.votos ? a : ordem.find(j => j.capa) || a;
  const chave = c ? c.id + "|" + (c.capa || "") : "";
  if (box.dataset.chave !== chave) {
    const nova = c ? capa(c.capa, c.nome, "capa caixa-capa") : Object.assign(document.createElement("div"), { className: "capa caixa-capa" });
    nova.id = capaId; nova.dataset.chave = chave;
    box.replaceWith(nova);
  }
}

// Frequentes: só a lista, sem votação (a capa é a do primeiro)
let assinaturaFrequentes = "";
function frequentes(lista = []) {
  const assinatura = JSON.stringify(lista);
  if (assinatura === assinaturaFrequentes) return;
  assinaturaFrequentes = assinatura;
  const box = $("listaFrequentes");
  box.replaceChildren();
  if (!lista.length) box.append(el("li", "vazio", "Nenhum jogo frequente agora."));
  lista.forEach(j => {
    const li = el("li");
    li.append(capa(j.capa, j.nome), el("span", null, j.nome));
    box.append(li);
  });
  const c = lista.find(j => j.capa) || lista[0];
  const nova = c ? capa(c.capa, c.nome, "capa caixa-capa") : el("div", "capa caixa-capa");
  nova.id = "capaFrequentes";
  $("capaFrequentes").replaceWith(nova);
}

conectar({
  aoEstado: s => {
    caixa("capaSeries", "infoSeries", s, "Nenhuma série na votação agora.");
    caixa("capaJogos", "infoJogos", s.entre, "Nenhum jogo curto na votação agora.");
    frequentes(s.frequentes);
    $("selo").classList.toggle("aovivo", !!s.aoVivo);
    $("seloTxt").textContent = s.aoVivo ? "Contando ao vivo" : "Votação aberta";
  }
});
addEventListener("scroll", () => $("nav").classList.toggle("rolou", scrollY > 8), { passive: true });
