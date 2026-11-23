<?php
// Atualiza o site (lives.temeron.com.br) com a branch "site" do GitHub.
// Chamado pelo PC do Ric (node publicar-site.js) com a chave secreta no cabeçalho X-Chave.
// Arquivos que saíram do site são apagados; a pasta api/dados (o placar) nunca é tocada.
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, max-age=0');
function sair($cod, $dados) { http_response_code($cod); echo json_encode($dados, JSON_UNESCAPED_UNICODE); exit; }

if ($_SERVER['REQUEST_METHOD'] !== 'POST') sair(405, ['erro' => 'método não permitido']);
require __DIR__ . '/config.php';
$chave = $_SERVER['HTTP_X_CHAVE'] ?? '';
if (!is_string($chave) || !hash_equals(CHAVE_HASH, hash('sha256', $chave))) sair(403, ['erro' => 'chave recusada']);

$raiz = dirname(__DIR__);
$dados = __DIR__ . '/dados';
if (!is_dir($dados)) mkdir($dados, 0755, true);
if (!is_file($dados . '/.htaccess')) file_put_contents($dados . '/.htaccess', "Require all denied
"); // pasta de dados nunca abre pelo navegador
$zip = $dados . '/site.zip';

// baixa o commit exato que o PC acabou de publicar (pelo nome da branch o GitHub às vezes entrega uma cópia antiga)
$pedido = json_decode(file_get_contents('php://input'), true);
$sha = is_array($pedido) && is_string($pedido['sha'] ?? null) && preg_match('/^[0-9a-f]{40}$/', $pedido['sha']) ? $pedido['sha'] : 'refs/heads/site';
$ch = curl_init('https://codeload.github.com/ricardovargas10/votacao-live/zip/' . $sha);
$fp = fopen($zip, 'w');
curl_setopt_array($ch, [CURLOPT_FILE => $fp, CURLOPT_FOLLOWLOCATION => true, CURLOPT_TIMEOUT => 60, CURLOPT_USERAGENT => 'site-atualizar']);
$ok = curl_exec($ch);
$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);
fclose($fp);
if (!$ok || $status !== 200) sair(502, ['erro' => "GitHub respondeu $status"]);

$z = new ZipArchive();
if ($z->open($zip) !== true) sair(500, ['erro' => 'zip inválido']);
$novos = [];
for ($i = 0; $i < $z->numFiles; $i++) {
  $nome = $z->getNameIndex($i);
  $rel = substr($nome, strpos($nome, '/') + 1); // tira a pasta "votacao-live-site/"
  if ($rel === '' || substr($rel, -1) === '/') continue;
  if (strpos($rel, '..') !== false || strpos($rel, 'api/dados/') === 0) continue;
  $destino = $raiz . '/' . $rel;
  if (!is_dir(dirname($destino))) mkdir(dirname($destino), 0755, true);
  $tmp = $destino . '.novo';
  file_put_contents($tmp, $z->getFromIndex($i));
  rename($tmp, $destino);
  $novos[] = $rel;
}
$z->close();
unlink($zip);

// apaga o que estava na publicação anterior e não está nesta
$manifesto = $dados . '/manifesto.json';
$antigos = is_file($manifesto) ? (json_decode(file_get_contents($manifesto), true) ?: []) : [];
$apagados = 0;
foreach (array_diff($antigos, $novos) as $rel) {
  if (strpos($rel, '..') === false && is_file("$raiz/$rel")) { unlink("$raiz/$rel"); $apagados++; }
}
file_put_contents($manifesto, json_encode($novos, JSON_UNESCAPED_SLASHES));
sair(200, ['ok' => true, 'versao' => substr($sha, 0, 7), 'arquivos' => count($novos), 'apagados' => $apagados]);
