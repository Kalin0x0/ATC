# ============================================================================
#  Atlantic Core - regenerate database/atc.sql from the ordered migrations.
#  Run from the repo root:  pwsh database/build-sql.ps1   (or Windows PowerShell)
#
#  Concatenates every packages/*/migrations/NNN_*.sql in numeric order into a
#  single importable schema file. Run this whenever migrations are added so a
#  fresh import always matches the latest schema.
# ============================================================================
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path $PSScriptRoot -Parent
$outFile  = Join-Path $PSScriptRoot 'atc.sql'

$files = Get-ChildItem -Path $repoRoot -Recurse -Filter '*.sql' -File |
  Where-Object { $_.FullName -notmatch 'node_modules' -and $_.Name -match '^\d+_' } |
  Sort-Object { [int]([regex]::Match($_.Name, '^\d+').Value) }

Write-Host "Found $($files.Count) migrations ($($files[0].Name) .. $($files[-1].Name))"

$sb = [System.Text.StringBuilder]::new()
[void]$sb.AppendLine('-- ============================================================================')
[void]$sb.AppendLine('--  Atlantic Core (ATC) - Full Database Schema')
[void]$sb.AppendLine('--  An open project by Naiemi Group.')
[void]$sb.AppendLine('--')
[void]$sb.AppendLine('--  Import this file into a fresh database named `atc` (MariaDB 11 / MySQL 8).')
[void]$sb.AppendLine("--  Built from $($files.Count) ordered schema migrations. See database/README.md")
[void]$sb.AppendLine('--  for step-by-step instructions (English / Farsi / Turkce / Espanol / Deutsch).')
[void]$sb.AppendLine('-- ============================================================================')
[void]$sb.AppendLine('')
[void]$sb.AppendLine('SET NAMES utf8mb4;')
[void]$sb.AppendLine("SET sql_mode = 'NO_AUTO_VALUE_ON_ZERO';")
[void]$sb.AppendLine('SET FOREIGN_KEY_CHECKS = 0;')
[void]$sb.AppendLine('')

foreach ($f in $files) {
  $content = (Get-Content $f.FullName -Raw).TrimEnd()
  if (-not $content.EndsWith(';')) { $content += ';' }
  [void]$sb.AppendLine('-- ---------------------------------------------------------------------------')
  [void]$sb.AppendLine("-- $($f.Name)")
  [void]$sb.AppendLine('-- ---------------------------------------------------------------------------')
  [void]$sb.AppendLine($content)
  [void]$sb.AppendLine('')
}

[void]$sb.AppendLine('SET FOREIGN_KEY_CHECKS = 1;')
[void]$sb.AppendLine('-- End of Atlantic Core schema.')

# Write UTF-8 WITHOUT BOM (a BOM breaks `mysql < atc.sql`)
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($outFile, $sb.ToString(), $utf8NoBom)

$kb = [math]::Round((Get-Item $outFile).Length / 1KB)
Write-Host "Wrote $outFile ($kb KB)"
