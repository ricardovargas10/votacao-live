# Votação do próximo jogo · Ric Chico

Site local com a votação ao vivo, a galeria dos jogos, as sinopses e a biblioteca completa, mais o overlay e o telão para o OBS.

## Páginas

| Página | Endereço | Para quê |
|---|---|---|
| Site | http://localhost:3000/ | Votação ao vivo, galeria, sinopses e biblioteca |
| Telão | http://localhost:3000/telao | Votação em tela cheia (1920x1080) para uma cena do OBS |
| Overlay | http://localhost:3000/overlay | Placar pequeno para o canto da tela do jogo |
| Admin | http://localhost:3000/admin | Configuração, só abre no seu PC |

## Como ligar

1. Instale o Node.js (versão 22 ou mais nova) em https://nodejs.org, se ainda não tiver.
2. Dê dois cliques em `iniciar.bat`. Abre uma janela preta (deixe aberta durante a live) e o Admin no navegador.

## Configuração (uma vez só)

### Twitch
1. Em https://dev.twitch.tv/console clique em *Register Your Application*.
2. Preencha: nome "Votação Ric Chico", *OAuth Redirect URL* `http://localhost:3000/auth/callback`, *Category* Broadcaster Suite, *Client Type* Confidential.
3. Clique em *Manage*, copie o *Client ID* e clique em *New Secret* para gerar o *Client Secret*.
4. No Admin, cole os dois, clique em **Salvar chaves** e depois em **Conectar com a Twitch**.
5. Em Recompensas, coloque o custo do voto e clique em **Criar ou atualizar recompensas**.

### Notion
1. Em https://www.notion.so/profile/integrations clique em **Nova integração**, dê o nome "Votação" e copie o token.
2. Na base "Ideias de jogos", clique nos três pontinhos > **Conexões** > escolha "Votação".
3. No Admin, cole o token e clique em **Salvar e sincronizar**.

Sem o Notion conectado, o site usa a cópia da lista salva em `exemplo/jogos-exemplo.json`.

## Como usar no dia a dia

- Para colocar ou tirar um jogo da votação: marque ou desmarque **É opção?** no Notion e clique em **Criar ou atualizar recompensas** no Admin.
- Colunas opcionais que o site entende se você criar no Notion: **Sinopse** (texto), **Capa** (arquivo ou link) e **Steam ID** (número).
- Votos, tokens e chaves ficam na pasta `data`, só no seu PC.
