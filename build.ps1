New-Item -ItemType Directory -Force -Path dist | Out-Null
npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
