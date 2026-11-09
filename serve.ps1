# servidor HTTP mínimo para o jogo (porta 8417)
$root = "C:\Users\jhona\Documents\atp-simulator"
$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://localhost:8417/")
$listener.Start()
Write-Host "Servindo $root em http://localhost:8417/"
$types = @{ ".html"="text/html; charset=utf-8"; ".css"="text/css"; ".js"="application/javascript"; ".png"="image/png"; ".jpg"="image/jpeg"; ".svg"="image/svg+xml"; ".md"="text/plain" }
while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $rel = $ctx.Request.Url.AbsolutePath.TrimStart("/")
  if ($rel -eq "") { $rel = "ATP-Challenge-FINAL.html" }
  $file = Join-Path $root ($rel -replace "/", "\")
  if (Test-Path $file -PathType Leaf) {
    $bytes = [IO.File]::ReadAllBytes($file)
    $ext = [IO.Path]::GetExtension($file).ToLower()
    $mime = if ($types.ContainsKey($ext)) { $types[$ext] } else { "application/octet-stream" }
    $ctx.Response.ContentType = $mime
    $ctx.Response.ContentLength64 = $bytes.Length
    $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  } else {
    $ctx.Response.StatusCode = 404
  }
  $ctx.Response.Close()
}
