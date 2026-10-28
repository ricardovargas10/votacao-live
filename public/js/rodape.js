// Rodapé igual em todas as páginas: as lives em destaque (cards grandes), depois redes sociais e canais.
const LIVE = [
  { nome: "Twitch", usuario: "ric_gameplays", url: "https://twitch.tv/ric_gameplays", cor: "#9146ff" },
  { nome: "Kick", usuario: "ric-gameplays", url: "https://kick.com/ric-gameplays", cor: "#53fc18" },
  { nome: "YouTube", usuario: "@ric_lives", url: "https://youtube.com/@ric_lives", cor: "#ff0033" }
];
const GRUPOS = [
  { titulo: "Redes sociais", links: [
    { nome: "Instagram", usuario: "ric_gameplays", url: "https://instagram.com/ric_gameplays" },
    { nome: "TikTok", usuario: "@ric_gameplays", url: "https://tiktok.com/@ric_gameplays" },
    { nome: "Twitter / X", usuario: "ric_gameplays", url: "https://x.com/ric_gameplays" }
  ] },
  { titulo: "Canais do YouTube", links: [
    { nome: "Gameplays", usuario: "@ric_gameplays", url: "https://youtube.com/@ric_gameplays" },
    { nome: "Cortes", usuario: "@ric_cortes", url: "https://youtube.com/@ric_cortes" }
  ] }
];

const link = (url, conteudo, cls) => `<a class="${cls}" href="${url}" target="_blank" rel="noopener">${conteudo}</a>`;

// Estrutura: logo e chamada / lives, redes sociais e canais do YouTube em 3 colunas / direitos
document.getElementById("rodape").innerHTML = `
  <div class="container">
    <div class="rodape-topo">
      <a class="rodape-marca" href="/">
        <img src="/img/ric.webp" alt="" width="48" height="48">
        <span class="display">Ric Gameplays</span>
      </a>
      <div class="rodape-chamada"><span class="ponto-vivo"></span>Ao vivo todos os dias às <b>19h!</b></div>
    </div>
    <div class="rodape-colunas">
      <div class="rodape-col rodape-col-live">
        <div class="eyebrow">Assista ao vivo</div>
        <div class="live-cards">
          ${LIVE.map(l => link(l.url, `<span class="live-cor" style="background:${l.cor}"></span><span class="live-txt"><b>${l.nome}</b><span>${l.usuario}</span></span><span class="seta">↗</span>`, "live-card")).join("")}
        </div>
      </div>
      ${GRUPOS.map(g => `<div class="rodape-col"><div class="eyebrow">${g.titulo}</div><ul>${g.links.map(l => `<li>${link(l.url, `<b>${l.nome}</b><span>${l.usuario}</span>`, "rodape-link")}</li>`).join("")}</ul></div>`).join("")}
    </div>
    <div class="rodape-fim">© ${new Date().getFullYear()} Ric Gameplays · votação com ChicoPoints</div>
  </div>`;

// menu Telão: fecha ao clicar fora dele
document.addEventListener("click", e => {
  document.querySelectorAll(".menu-telao details[open]").forEach(d => { if (!d.contains(e.target)) d.open = false; });
});
