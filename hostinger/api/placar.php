<?php
// Placar do site (lives.temeron.com.br). O PC do Ric manda o placar aqui; o site lê daqui a cada poucos segundos.
// Ler é público. Gravar só com a chave secreta no cabeçalho X-Chave (o arquivo config.php guarda só o resumo dela).
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, max-age=0');
$arquivo = __DIR__ . '/dados/estado.json';

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
  echo is_file($arquivo) ? file_get_contents($arquivo) : '{}';
  exit;
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); echo '{"erro":"método não permitido"}'; exit; }

require __DIR__ . '/config.php';
$chave = $_SERVER['HTTP_X_CHAVE'] ?? '';
if (!is_string($chave) || !hash_equals(CHAVE_HASH, hash('sha256', $chave))) { http_response_code(403); echo '{"erro":"chave recusada"}'; exit; }

$corpo = file_get_contents('php://input', false, null, 0, 5000000);
$novo = json_decode($corpo, true);
if (!is_array($novo) || !isset($novo['linhas']) || !is_array($novo['linhas'])) { http_response_code(400); echo '{"erro":"pedido inválido"}'; exit; }

if (!is_dir(__DIR__ . '/dados')) mkdir(__DIR__ . '/dados', 0755, true);
$fp = fopen($arquivo, 'c+');
flock($fp, LOCK_EX);
$atual = json_decode(stream_get_contents($fp), true) ?: [];
foreach ($novo['linhas'] as $l) {
  // só as duas linhas que o site usa
  if (isset($l['id']) && in_array($l['id'], ['placar', 'biblioteca'], true)) $atual[$l['id']] = $l['dados'] ?? null;
}
$atual['atualizado'] = (int) round(microtime(true) * 1000);
ftruncate($fp, 0);
rewind($fp);
fwrite($fp, json_encode($atual, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
fflush($fp);
flock($fp, LOCK_UN);
fclose($fp);
echo '{"ok":true}';
