// Conexão com a Twitch: login, recompensas de ChicoPoints e escuta dos resgates (EventSub).
import crypto from "node:crypto";

const ESCOPOS = "channel:read:redemptions channel:manage:redemptions";
export const PREFIXO = "Série: ";       // jogos longos
export const PREFIXO_ENTRE = "Jogo: ";   // jogos rápidos entre lives
const MAX_TITULO = 45; // limite da Twitch para o título da recompensa

export function tituloRecompensa(nome, prefixo = PREFIXO) {
  return (prefixo + nome).slice(0, MAX_TITULO).trim();
}

export function criarTwitch({ getConta, salvarConta, aoResgatar, aoMudarStatus, aoConectar }) {
  let ws = null, keepaliveTimer = null, tentativas = 0, keepaliveSeg = 10, parado = false;
  let estadoOAuth = null; // protege o /auth/callback contra login forjado
  const status = { conectado: false, login: null, mensagem: "Não conectado" };

  function setStatus(p) { Object.assign(status, p); aoMudarStatus?.({ ...status }); }

  function authUrl(redirect) {
    const c = getConta();
    estadoOAuth = crypto.randomBytes(16).toString("hex");
    const q = new URLSearchParams({ client_id: c.clientId, redirect_uri: redirect, response_type: "code", scope: ESCOPOS, force_verify: "true", state: estadoOAuth });
    return `https://id.twitch.tv/oauth2/authorize?${q}`;
  }

  async function tokenRequest(params) {
    const r = await fetch("https://id.twitch.tv/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(params)
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(d.message || `Twitch respondeu ${r.status}`); e.status = r.status; throw e; }
    return d;
  }

  function guardar(d) {
    const c = getConta();
    c.access = d.access_token;
    if (d.refresh_token) c.refresh = d.refresh_token;
    c.expira = Date.now() + (d.expires_in || 3600) * 1000;
    salvarConta(c);
  }

  async function trocarCodigo(code, redirect, state) {
    if (!estadoOAuth || state !== estadoOAuth) throw new Error("Login recusado: clique em Conectar com a Twitch de novo");
    estadoOAuth = null;
    const c = getConta();
    guardar(await tokenRequest({ client_id: c.clientId, client_secret: c.clientSecret, code, grant_type: "authorization_code", redirect_uri: redirect }));
    await iniciar();
  }

  let renovando = null;
  function renovar() {
    // vários pedidos ao mesmo tempo usam a mesma renovação
    renovando ||= (async () => {
      const c = getConta();
      if (!c.refresh) throw new Error("Conta não conectada");
      try {
        guardar(await tokenRequest({ client_id: c.clientId, client_secret: c.clientSecret, grant_type: "refresh_token", refresh_token: c.refresh }));
      } catch (e) {
        // só esquece o login quando a Twitch recusa; sem internet, tenta de novo depois
        if (e.status === 400 || e.status === 401) {
          c.access = null; c.refresh = null; salvarConta(c);
          parado = true;
          throw new Error("Login expirou, conecte de novo no admin");
        }
        throw new Error("Sem resposta da Twitch, tentando de novo");
      }
    })().finally(() => { renovando = null; });
    return renovando;
  }

  async function api(caminho, opcoes = {}, tentou = false) {
    const c = getConta();
    if (!c.access || Date.now() > (c.expira || 0) - 60000) await renovar();
    const r = await fetch("https://api.twitch.tv/helix" + caminho, {
      ...opcoes,
      headers: { "Authorization": "Bearer " + getConta().access, "Client-Id": c.clientId, "Content-Type": "application/json" }
    });
    if (r.status === 401 && !tentou) { await renovar(); return api(caminho, opcoes, true); }
    const corpo = r.status === 204 ? {} : await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(corpo.message || `erro ${r.status}`); e.status = r.status; throw e; }
    return corpo;
  }

  async function iniciar() {
    const c = getConta();
    clearTimeout(reconTimer); reconTimer = null;
    fecharSocket(); // nunca deixa duas conexões abertas (a Twitch aceita no máximo 3)
    if (!c.clientId || !c.refresh) { setStatus({ conectado: false, mensagem: "Não conectado" }); return; }
    parado = false;
    try {
      const u = await api("/users");
      c.userId = u.data[0].id; c.login = u.data[0].login; salvarConta(c);
      setStatus({ login: c.login, mensagem: "Conectando…" });
      abrirSocket("wss://eventsub.wss.twitch.tv/ws");
    } catch (e) {
      setStatus({ conectado: false, mensagem: e.message });
      agendarReconexao(e.message);
    }
  }

  function fecharSocket() {
    clearTimeout(keepaliveTimer);
    if (ws) { ws.onclose = null; try { ws.close(); } catch {} ws = null; }
  }

  function abrirSocket(url, reconexao = false) {
    const sock = new WebSocket(url);
    sock.onmessage = async ev => {
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      const tipo = m.metadata?.message_type;
      if (tipo === "session_welcome") {
        const s = m.payload.session;
        armarKeepalive(s.keepalive_timeout_seconds);
        // session_reconnect: a conexão nova assume e a antiga fecha; as assinaturas continuam valendo
        if (ws && ws !== sock) { ws.onclose = null; try { ws.close(); } catch {} }
        ws = sock;
        if (!reconexao) {
          try {
            await api("/eventsub/subscriptions", {
              method: "POST",
              body: JSON.stringify({
                type: "channel.channel_points_custom_reward_redemption.add", version: "1",
                condition: { broadcaster_user_id: getConta().userId },
                transport: { method: "websocket", session_id: s.id }
              })
            });
          } catch (e) {
            fecharSocket();
            setStatus({ conectado: false, mensagem: "Erro ao escutar resgates: " + e.message });
            agendarReconexao("Erro ao escutar resgates: " + e.message);
            return;
          }
        }
        tentativas = 0;
        setStatus({ conectado: true, mensagem: "Contando votos" });
        if (!reconexao) aoConectar?.();
      } else if (tipo === "session_keepalive") {
        armarKeepalive();
      } else if (tipo === "notification") {
        armarKeepalive();
        const e = m.payload.event;
        aoResgatar({ id: e.id, quem: e.user_name, rewardId: e.reward.id, titulo: e.reward.title, t: Date.parse(e.redeemed_at) || Date.now() });
      } else if (tipo === "session_reconnect") {
        abrirSocket(m.payload.session.reconnect_url, true);
      } else if (tipo === "revocation") {
        fecharSocket(); agendarReconexao();
      }
    };
    sock.onclose = () => { if (sock === ws) { ws = null; clearTimeout(keepaliveTimer); agendarReconexao(); } };
    sock.onerror = () => {};
    if (!ws) ws = sock;
  }

  function armarKeepalive(seg) {
    if (seg) keepaliveSeg = seg;
    clearTimeout(keepaliveTimer);
    keepaliveTimer = setTimeout(() => { fecharSocket(); agendarReconexao(); }, (keepaliveSeg + 10) * 1000);
  }

  let reconTimer = null;
  function agendarReconexao(motivo) {
    if (parado || reconTimer) return;
    setStatus({ conectado: false, mensagem: motivo ? motivo + " · tentando de novo…" : "Conexão caiu, tentando de novo…" });
    const espera = Math.min(60000, 2000 * 2 ** tentativas++);
    reconTimer = setTimeout(() => { reconTimer = null; iniciar(); }, espera);
  }

  function desconectar() {
    parado = true;
    clearTimeout(reconTimer); reconTimer = null;
    fecharSocket();
    const c = getConta();
    c.access = null; c.refresh = null; c.userId = null; c.login = null;
    salvarConta(c);
    setStatus({ conectado: false, login: null, mensagem: "Desconectado" });
  }

  // Resgates recentes das recompensas criadas aqui (a Twitch guarda alguns dias).
  // Serve para contar os votos feitos enquanto o programa estava fechado.
  async function resgatesRecentes() {
    const c = getConta();
    if (!c.userId) return [];
    const lista = [];
    for (const rewardId of Object.keys(c.recompensas || {})) {
      for (const st of ["FULFILLED", "UNFULFILLED"]) {
        let cursor = "";
        for (let pagina = 0; pagina < 10; pagina++) {
          let d;
          try {
            d = await api(`/channel_points/custom_rewards/redemptions?broadcaster_id=${c.userId}&reward_id=${rewardId}&status=${st}&sort=NEWEST&first=50${cursor ? "&after=" + cursor : ""}`);
          } catch (e) {
            if (e.status === 404) break; // recompensa apagada na Twitch
            throw e;
          }
          (d.data || []).forEach(r => lista.push({ id: r.id, quem: r.user_name, rewardId: r.reward.id, titulo: r.reward.title, t: Date.parse(r.redeemed_at) }));
          cursor = d.pagination?.cursor;
          if (!cursor) break;
        }
      }
    }
    return lista.sort((a, b) => a.t - b.t);
  }

  // Recebe a lista de recompensas que devem existir ({ chave, nome, titulo, custo, prompt }):
  // cria ou liga cada uma e desliga as criadas aqui que não estão mais na lista.
  // chave = id do jogo (votação principal) ou "entre:" + id (votação entre lives).
  async function sincronizarRecompensas(itens) {
    const c = getConta();
    if (!c.userId) throw new Error("Conecte a Twitch primeiro");
    c.recompensas = c.recompensas || {};
    // só as recompensas criadas por este app (as feitas à mão a Twitch não deixa mexer)
    const existentes = (await api(`/channel_points/custom_rewards?broadcaster_id=${c.userId}&only_manageable_rewards=true`)).data || [];
    const ids = new Set(existentes.map(r => r.id));
    Object.keys(c.recompensas).forEach(id => { if (!ids.has(id)) delete c.recompensas[id]; }); // apagadas na Twitch
    const porChave = {};
    existentes.forEach(r => { const ch = c.recompensas[r.id]; if (ch) porChave[ch] = r; });
    const relatorio = [];
    for (const it of itens) {
      // recompensa deste app com o mesmo título mas sem dono (ex.: data/ apagada): adota
      const atual = porChave[it.chave] || existentes.find(r => !c.recompensas[r.id] && r.title.toLowerCase() === it.titulo.toLowerCase());
      try {
        if (atual) {
          await api(`/channel_points/custom_rewards?broadcaster_id=${c.userId}&id=${atual.id}`, {
            method: "PATCH", body: JSON.stringify({ title: it.titulo, cost: it.custo, is_enabled: true, is_paused: false })
          });
          c.recompensas[atual.id] = it.chave;
          relatorio.push({ jogo: it.titulo, ok: true, acao: "atualizada" });
        } else {
          const r = await api(`/channel_points/custom_rewards?broadcaster_id=${c.userId}`, {
            method: "POST",
            body: JSON.stringify({ title: it.titulo, cost: it.custo, prompt: it.prompt, is_enabled: true, should_redemptions_skip_request_queue: true })
          });
          c.recompensas[r.data[0].id] = it.chave;
          relatorio.push({ jogo: it.titulo, ok: true, acao: "criada" });
        }
      } catch (e) {
        relatorio.push({ jogo: it.titulo, ok: false, acao: /DUPLICATE/i.test(e.message) ? `já existe a recompensa "${it.titulo}" criada à mão na Twitch; apague ela no painel do criador (Recompensas > Gerenciar recompensas) e clique aqui de novo` : e.message });
      }
    }
    const chaves = new Set(itens.map(it => it.chave));
    for (const r of existentes) {
      const ch = c.recompensas[r.id];
      if (ch && !chaves.has(ch) && r.is_enabled) {
        try {
          await api(`/channel_points/custom_rewards?broadcaster_id=${c.userId}&id=${r.id}`, { method: "PATCH", body: JSON.stringify({ is_enabled: false }) });
          relatorio.push({ jogo: r.title, ok: true, acao: "desligada (saiu da votação)" });
        } catch (e) { relatorio.push({ jogo: r.title, ok: false, acao: e.message }); }
      }
    }
    salvarConta(c);
    return relatorio;
  }

  return { authUrl, trocarCodigo, iniciar, desconectar, sincronizarRecompensas, resgatesRecentes, status: () => ({ ...status }) };
}
