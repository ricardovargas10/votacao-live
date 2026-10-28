// Configura o OBS para a votação: overlay na cena do jogo e cena "Votação" com o telão.
// Rode com:  node configurar-obs.js   (ou dois cliques em configurar-obs.bat)
// A senha do WebSocket do OBS é pedida aqui e não fica salva em lugar nenhum.
import crypto from "node:crypto";
import readline from "node:readline";

const PORTA_OBS = 4455;
const BASE = "http://localhost:3000";
const OVERLAY = { nome: "Overlay votação", url: BASE + "/overlay", largura: 470, altura: 400 };
const TELAO = { nome: "Telão votação", url: BASE + "/telao", largura: 1920, altura: 1080 };
const CENA_TELAO = "Votação";
const ARQUIVOS_ANTIGOS = ["placar-votacao.html", "painel-votacao.html", "tela-votacao.html"];

/* ---------- perguntas no terminal ---------- */
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const perguntar = q => new Promise(ok => rl.question(q, r => ok(r.trim())));
function perguntarSenha(q) {
  return new Promise(ok => {
    const escrever = rl._writeToOutput;
    rl._writeToOutput = s => { if (s.includes(q)) process.stdout.write(s); else process.stdout.write("*".repeat(s.length ? 1 : 0)); };
    rl.question(q, r => { rl._writeToOutput = escrever; process.stdout.write("\n"); ok(r); });
  });
}
const sim = r => /^s(im)?$/i.test(r);

/* ---------- OBS WebSocket (protocolo 5) ---------- */
function conectar(senha) {
  return new Promise((ok, falha) => {
    const ws = new WebSocket(`ws://127.0.0.1:${PORTA_OBS}`);
    const pendentes = new Map();
    let n = 0;
    const pedir = (requestType, requestData = {}) => new Promise((res, rej) => {
      const requestId = String(++n);
      pendentes.set(requestId, { res, rej, requestType });
      ws.send(JSON.stringify({ op: 6, d: { requestType, requestId, requestData } }));
    });
    ws.onerror = () => falha(new Error(`Não achei o OBS na porta ${PORTA_OBS}. Ele está aberto, com o servidor WebSocket ativado?`));
    ws.onclose = e => { if (e.code === 4009) falha(new Error("Senha errada.")); };
    ws.onmessage = ev => {
      const m = JSON.parse(ev.data);
      if (m.op === 0) { // Hello
        const d = { rpcVersion: 1 };
        if (m.d.authentication) {
          const { challenge, salt } = m.d.authentication;
          const segredo = crypto.createHash("sha256").update(senha + salt).digest("base64");
          d.authentication = crypto.createHash("sha256").update(segredo + challenge).digest("base64");
        }
        ws.send(JSON.stringify({ op: 1, d }));
      } else if (m.op === 2) { // Identified
        ok({ pedir, fechar: () => ws.close() });
      } else if (m.op === 7) {
        const p = pendentes.get(m.d.requestId);
        if (!p) return;
        pendentes.delete(m.d.requestId);
        if (m.d.requestStatus.result) p.res(m.d.responseData || {});
        else p.rej(new Error(`${p.requestType}: ${m.d.requestStatus.comment || "erro " + m.d.requestStatus.code}`));
      }
    };
  });
}

/* ---------- passos ---------- */
const configNavegador = f => ({
  url: f.url, is_local_file: false, width: f.largura, height: f.altura,
  shutdown: false,            // "Desligar fonte quando não estiver visível" desmarcado
  restart_when_active: false  // "Atualizar navegador quando a cena se tornar ativa" desmarcado
});

async function existeFonte(obs, nome) {
  const { inputs } = await obs.pedir("GetInputList");
  return inputs.some(i => i.inputName === nome);
}

// cria a fonte na cena, ou reaproveita se ela já existir (rodar o script duas vezes não duplica)
async function garantirFonte(obs, cena, f) {
  if (await existeFonte(obs, f.nome)) {
    await obs.pedir("SetInputSettings", { inputName: f.nome, inputSettings: configNavegador(f), overlay: true });
    const { sceneItems } = await obs.pedir("GetSceneItemList", { sceneName: cena });
    const item = sceneItems.find(i => i.sourceName === f.nome);
    if (item) return item.sceneItemId;
    return (await obs.pedir("CreateSceneItem", { sceneName: cena, sourceName: f.nome })).sceneItemId;
  }
  return (await obs.pedir("CreateInput", { sceneName: cena, inputName: f.nome, inputKind: "browser_source", inputSettings: configNavegador(f), sceneItemEnabled: true })).sceneItemId;
}

async function main() {
  console.log("\n  Configurar o OBS para a votação\n");
  console.log("  No OBS: Ferramentas > Configurações do servidor WebSocket > Mostrar informações de conexão.");
  const senha = await perguntarSenha("  Cole a senha do servidor WebSocket e aperte Enter: ");
  const obs = await conectar(senha);
  console.log("  Conectado ao OBS.\n");

  const { baseWidth, baseHeight } = await obs.pedir("GetVideoSettings");

  // 1. cena do overlay
  const { scenes } = await obs.pedir("GetSceneList");
  const cenas = scenes.map(s => s.sceneName).reverse(); // mesma ordem da lista de Cenas do OBS
  console.log("  Suas cenas:");
  cenas.forEach((c, i) => console.log(`   ${i + 1}. ${c}`));
  let cenaOverlay;
  while (!cenaOverlay) {
    const r = await perguntar("\n  Em qual cena vai o overlay? Digite o número: ");
    cenaOverlay = cenas[Number(r) - 1];
    if (!cenaOverlay) console.log("  Número não encontrado, tente de novo.");
  }

  // 2. fontes antigas
  const { inputs } = await obs.pedir("GetInputList", { inputKind: "browser_source" });
  const antigas = [];
  for (const i of inputs) {
    const { inputSettings: s } = await obs.pedir("GetInputSettings", { inputName: i.inputName });
    const alvo = `${s.url || ""} ${s.local_file || ""}`.toLowerCase();
    const arquivo = ARQUIVOS_ANTIGOS.find(a => alvo.includes(a));
    if (arquivo) antigas.push({ nome: i.inputName, arquivo });
  }
  if (antigas.length) {
    console.log("\n  Achei fontes Navegador antigas da votação:");
    antigas.forEach(a => console.log(`   - "${a.nome}" (${a.arquivo})`));
    const r = await perguntar("  Apagar essas fontes do OBS? (s/n): ");
    if (sim(r)) {
      for (const a of antigas) await obs.pedir("RemoveInput", { inputName: a.nome });
      console.log("  Apagadas.");
    } else console.log("  Mantidas.");
  } else console.log("\n  Nenhuma fonte antiga encontrada.");

  // 3. overlay no canto superior direito
  const idOverlay = await garantirFonte(obs, cenaOverlay, OVERLAY);
  await obs.pedir("SetSceneItemTransform", {
    sceneName: cenaOverlay, sceneItemId: idOverlay,
    sceneItemTransform: { positionX: baseWidth - OVERLAY.largura, positionY: 0, alignment: 5, scaleX: 1, scaleY: 1, boundsType: "OBS_BOUNDS_NONE" }
  });
  await obs.pedir("SetSceneItemIndex", { sceneName: cenaOverlay, sceneItemId: idOverlay, sceneItemIndex: (await obs.pedir("GetSceneItemList", { sceneName: cenaOverlay })).sceneItems.length - 1 });
  console.log(`\n  "${OVERLAY.nome}" está na cena "${cenaOverlay}", canto superior direito.`);

  // 4. cena do telão
  if (!cenas.includes(CENA_TELAO)) await obs.pedir("CreateScene", { sceneName: CENA_TELAO });
  const idTelao = await garantirFonte(obs, CENA_TELAO, TELAO);
  await obs.pedir("SetSceneItemTransform", {
    sceneName: CENA_TELAO, sceneItemId: idTelao,
    sceneItemTransform: { positionX: 0, positionY: 0, alignment: 5, scaleX: baseWidth / TELAO.largura, scaleY: baseHeight / TELAO.altura, boundsType: "OBS_BOUNDS_NONE" }
  });
  console.log(`  "${TELAO.nome}" está na cena "${CENA_TELAO}", tela cheia.`);
  console.log(`  Nas duas fontes, "Desligar fonte quando não estiver visível" ficou desmarcado.\n`);

  obs.fechar();
}

main()
  .catch(e => console.error("\n  Erro: " + e.message + "\n"))
  .finally(() => rl.close());
