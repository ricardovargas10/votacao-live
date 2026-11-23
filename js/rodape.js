// Rodapé igual em todas as páginas: lives, redes sociais, canais do YouTube e comunidade.
// Live todos os dias às 19h na Twitch e no YouTube (a Kick saiu).
const LIVE = [
  { nome: "Twitch", usuario: "ric_gameplays", url: "https://twitch.tv/ric_gameplays", cor: "#9146ff" },
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
    { nome: "Vlogs", usuario: "@o_ricardocarvalho", url: "https://youtube.com/@o_ricardocarvalho" }
  ] },
  { titulo: "Comunidade", links: [
    { nome: "Discord", usuario: "Entre para a nossa comunidade", url: "https://discord.gg/4jtUT4HGaC" },
    { nome: "LivePix", usuario: "Apoie o canal", url: "https://livepix.gg/ricgameplays" },
    { nome: "Spotify", usuario: "Playlist dos inscritos", url: "https://open.spotify.com/playlist/2mQninpIxtRe11WPOM6ceH" }
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
      <div class="rodape-chamada">Ao vivo todos os dias às 19h</div>
    </div>
    <div class="rodape-colunas">
      <div class="rodape-col rodape-col-live">
        <div class="eyebrow">Assista ao vivo</div>
        <ul>${LIVE.map(l => `<li>${link(l.url, `<i class="live-cor" style="background:${l.cor}"></i><b>${l.nome}</b><span>${l.usuario}</span>`, "rodape-link live-link")}</li>`).join("")}</ul>
      </div>
      ${GRUPOS.map(g => `<div class="rodape-col"><div class="eyebrow">${g.titulo}</div><ul>${g.links.map(l => `<li>${link(l.url, `<b>${l.nome}</b><span>${l.usuario}</span>`, "rodape-link")}</li>`).join("")}</ul></div>`).join("")}
    </div>
    <div class="rodape-fim">© ${new Date().getFullYear()} Ric Gameplays · votação com RicPoints</div>
  </div>`;

// menu Telão: fecha ao clicar fora dele
document.addEventListener("click", e => {
  document.querySelectorAll(".menu-telao details[open]").forEach(d => { if (!d.contains(e.target)) d.open = false; });
});
