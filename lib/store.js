// Guarda dados em arquivos JSON na pasta /data (só no seu PC).
import fs from "node:fs";
import path from "node:path";

const DIR = path.join(import.meta.dirname, "..", "data");
fs.mkdirSync(DIR, { recursive: true });

export function ler(nome, padrao) {
  const arquivo = path.join(DIR, nome);
  let texto;
  try { texto = fs.readFileSync(arquivo, "utf8"); } catch { return structuredClone(padrao); }
  try {
    return JSON.parse(texto);
  } catch {
    // arquivo estragado: guarda uma cópia antes de começar do zero, para nada se perder
    try { fs.copyFileSync(arquivo, `${arquivo}.estragado-${Date.now()}`); } catch {}
    console.error(`Aviso: ${nome} estava estragado. Cópia guardada em data/ e começando do zero.`);
    return structuredClone(padrao);
  }
}

const pendentes = new Map(); // nome -> { timer, dados }
export function gravar(nome, dados) {
  // junta gravações seguidas num intervalo curto
  clearTimeout(pendentes.get(nome)?.timer);
  pendentes.set(nome, { dados, timer: setTimeout(() => gravarAgora(nome, dados), 150) });
}

export function gravarAgora(nome, dados) {
  clearTimeout(pendentes.get(nome)?.timer);
  pendentes.delete(nome);
  const destino = path.join(DIR, nome);
  const temp = destino + ".tmp";
  const texto = JSON.stringify(dados, null, 2);
  fs.writeFileSync(temp, texto);
  try {
    fs.renameSync(temp, destino);
  } catch {
    // antivírus segurando o arquivo: grava direto
    fs.writeFileSync(destino, texto);
    try { fs.unlinkSync(temp); } catch {}
  }
}

// grava na hora tudo o que ainda estava esperando (usado ao fechar o programa)
export function gravarPendentes() {
  for (const [nome, { dados }] of [...pendentes]) {
    try { gravarAgora(nome, dados); } catch {}
  }
}
