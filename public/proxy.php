<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$n8n_url = 'https://n8n.kleza.io/webhook/bf39cd7e-9f1b-4b3e-98eb-8b746cd2b510/chat';

$body = file_get_contents('php://input');

/*
 * Hostinger's nginx returns a 504 after ~55s of silence from upstream. That limit
 * is the gap BETWEEN reads, not the total request time — so emitting a byte every
 * few seconds keeps the connection alive for as long as n8n needs.
 *
 * The keep-alive bytes are spaces written before the real payload. Whitespace
 * ahead of a JSON document is legal, so JSON.parse() on the client is unaffected.
 */
@set_time_limit(300);
@ini_set('zlib.output_compression', 'off');
@ini_set('output_buffering', 'off');
while (ob_get_level() > 0) { ob_end_flush(); }
ob_implicit_flush(true);

header('Content-Type: application/json');
header('X-Accel-Buffering: no');   // ask nginx not to buffer this response

$lastPing = microtime(true);

$ch = curl_init($n8n_url);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => $body,
    CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
    CURLOPT_TIMEOUT        => 300,
    CURLOPT_SSL_VERIFYPEER => true,
    CURLOPT_NOPROGRESS     => false,
    // Fires periodically while the request is in flight — our heartbeat hook.
    CURLOPT_PROGRESSFUNCTION => function () use (&$lastPing) {
        if (microtime(true) - $lastPing >= 5) {
            echo ' ';
            flush();
            $lastPing = microtime(true);
        }
        return 0;   // non-zero would abort the transfer
    },
]);

$response  = curl_exec($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$error     = curl_error($ch);
curl_close($ch);

/*
 * Output has already begun, so the HTTP status can no longer be changed. Upstream
 * failures are surfaced in the JSON body instead, which the client checks for.
 */
if ($error) {
    echo json_encode(['error' => 'Proxy error: ' . $error]);
    exit();
}

if ($http_code >= 400) {
    echo json_encode(['error' => "n8n returned HTTP $http_code", 'upstream' => substr((string) $response, 0, 500)]);
    exit();
}

echo $response;
