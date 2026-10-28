// Manda o placar para o Supabase, de onde o site público (Vercel) lê ao vivo.
// O PC continua sendo quem conta os votos; o Supabase só guarda uma cópia para quem está fora daqui.
export function criarPublicador(getConfig) {
  const status = { ativo: false, ok: false, erro: null, ultimoEnvio: null };
  const pendentes = new Map(); // id da linha -> dados
  let timer = null, enviando = false;

  async function enviar() {
    timer = null;
    const cfg = getConfig();
    if (!cfg?.url || !cfg?.secreta || !pendentes.size) return;
    if (enviando) { timer = setTimeout(enviar, 300); return; }
    enviando = true;
    const linhas = [...pendentes].map(([id, dados]) => ({ id, dados, atualizado: new Date().toISOString() }));
    pendentes.clear();
    try {
      const headers = { "apikey": cfg.secreta, "Content-Type": "application/json", "Prefer": "resolution=merge-duplicates,return=minimal" };
      if (!cfg.secreta.startsWith("sb_")) headers.Authorization = "Bearer " + cfg.secreta; // chave antiga (service_role)
      const r = await fetch(`${cfg.url}/rest/v1/estado`, { method: "POST", headers, body: JSON.stringify(linhas) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || `Supabase respondeu ${r.status}`);
      Object.assign(status, { ok: true, erro: null, ultimoEnvio: Date.now() });
    } catch (e) {
      // sem internet: guarda de novo e tenta daqui a pouco (o mais novo de cada linha vale)
      linhas.forEach(l => { if (!pendentes.has(l.id)) pendentes.set(l.id, l.dados); });
      Object.assign(status, { ok: false, erro: e.message });
      timer = setTimeout(enviar, 5000);
    } finally {
      enviando = false;
    }
  }

  // junta atualizações seguidas e manda no máximo uma vez a cada 0,7 s
  function publicar(id, dados) {
    status.ativo = !!(getConfig()?.url && getConfig()?.secreta);
    if (!status.ativo) return;
    pendentes.set(id, dados);
    if (!timer) timer = setTimeout(enviar, 700);
  }

  return { publicar, status: () => ({ ...status, ativo: !!(getConfig()?.url && getConfig()?.secreta) }) };
}
