// Publica o site na Hostinger (lives.temeron.com.br).
// Junta public/ (sem o admin, que mora em privado/) com hostinger/ (.htaccess e api/) na branch "site"
// do GitHub, e pede ao site (api/atualizar.php) que baixe a branch. A chave fica em data/hostinger.json.
// Uso: node publicar-site.js
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const RAIZ = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const PASTA = path.join(os.tmpdir(), "ric-votacao-site");
const git = (args, cwd = RAIZ) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const tentar = (...a) => { try { return git(...a); } catch { return null; } };

// pasta de trabalho limpa ligada à branch "site"
tentar(["worktree", "remove", "--force", PASTA]);
fs.rmSync(PASTA, { recursive: true, force: true });
tentar(["worktree", "prune"]);
const temRemota = tentar(["fetch", "origin", "site"]) !== null;
if (temRemota) {
  git(["worktree", "add", "-B", "site", PASTA, "origin/site"]);
} else {
  git(["worktree", "add", "--detach", PASTA]);
  git(["checkout", "--orphan", "site"], PASTA);
  git(["rm", "-rf", "--quiet", "."], PASTA);
}

// troca todo o conteúdo pelo site atual
for (const f of fs.readdirSync(PASTA)) if (f !== ".git") fs.rmSync(path.join(PASTA, f), { recursive: true, force: true });
fs.cpSync(path.join(RAIZ, "public"), PASTA, { recursive: true, filter: f => !f.endsWith("config-publico.js") });
fs.cpSync(path.join(RAIZ, "hostinger"), PASTA, { recursive: true });
fs.writeFileSync(path.join(PASTA, ".gitignore"), "api/dados/\n");

git(["add", "-A"], PASTA);
if (!git(["status", "--porcelain"], PASTA)) {
  console.log("Nada mudou no site desde a última publicação.");
} else {
  git(["commit", "--quiet", "-m", "Site: publicação de " + new Date().toLocaleString("pt-BR")], PASTA);
  git(["push", "--quiet", "origin", "site"], PASTA);
  console.log("Branch site atualizada no GitHub.");
}
git(["worktree", "remove", "--force", PASTA]);

// pede ao site que baixe a branch nova (api/atualizar.php, com a mesma chave do placar)
const cfg = JSON.parse(fs.readFileSync(path.join(RAIZ, "data", "hostinger.json"), "utf8"));
const url = cfg.url.replace(/placar\.php$/, "atualizar.php");
const r = await fetch(url, { method: "POST", headers: { "X-Chave": cfg.chave } });
const d = await r.json().catch(() => ({}));
console.log(r.ok ? `Site atualizado: ${d.arquivos} arquivos (${d.apagados} apagados).` : `O site respondeu ${r.status}: ${d.erro || "erro"}`);
