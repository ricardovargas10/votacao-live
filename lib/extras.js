// Jogos que não estão na Steam: capa, sinopse e informações guardadas no próprio projeto.
// As imagens ficam em public/img/capas (baixadas dos sites oficiais de cada jogo).
// A chave é o nome do jogo no Notion, normalizado (minúsculas, sem acento nem pontuação).
export const EXTRAS = {
  "valorant": {
    capa: "/img/capas/valorant-capa.jpg",
    fundo: "/img/capas/valorant-fundo.jpg",
    sinopse: "Jogo de tiro tático 5 contra 5 com agentes de habilidades únicas. Cada rodada mistura mira precisa e estratégia em equipe para plantar ou desarmar a Spike.",
    generos: ["Tiro", "Tático"],
    lancamento: "2 jun. 2020",
    desenvolvedora: "Riot Games",
    lojaUrl: "https://playvalorant.com/pt-br/",
    lojaNome: "Ver o site oficial"
  },
  "hytale": {
    capa: "/img/capas/hytale-capa.jpg",
    fundo: "/img/capas/hytale-fundo.jpg",
    sinopse: "Aventura sandbox em blocos: explore um mundo cheio de masmorras e criaturas, construa o que quiser e jogue minigames e mods criados pela comunidade.",
    generos: ["Aventura", "Sandbox"],
    desenvolvedora: "Hypixel Studios",
    lojaUrl: "https://hytale.com/",
    lojaNome: "Ver o site oficial"
  },
  "roblox": {
    capa: "/img/capas/roblox-capa.jpg",
    fundo: "/img/capas/roblox-capa.jpg",
    sinopse: "Plataforma com milhões de jogos criados pela comunidade, de corridas e obbys a terror e simuladores, para jogar junto com os amigos.",
    generos: ["Multijogador", "Plataforma de jogos"],
    lancamento: "2006",
    desenvolvedora: "Roblox Corporation",
    lojaUrl: "https://www.roblox.com/",
    lojaNome: "Ver o site oficial"
  }
};
