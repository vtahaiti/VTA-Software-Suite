param([string]$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path)

Add-Type -AssemblyName System.Drawing

function New-VtaPosIcon([int]$Size, [string]$Path) {
  $bitmap = [System.Drawing.Bitmap]::new($Size, $Size)
  $bitmap.SetResolution(144, 144)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.Clear([System.Drawing.Color]::Transparent)

  $margin = [int]($Size * 0.08)
  $radius = [int]($Size * 0.19)
  $rect = [System.Drawing.Rectangle]::new($margin, $margin, $Size - 2 * $margin, $Size - 2 * $margin)
  $pathShape = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $diameter = $radius * 2
  $pathShape.AddArc($rect.X, $rect.Y, $diameter, $diameter, 180, 90)
  $pathShape.AddArc($rect.Right - $diameter, $rect.Y, $diameter, $diameter, 270, 90)
  $pathShape.AddArc($rect.Right - $diameter, $rect.Bottom - $diameter, $diameter, $diameter, 0, 90)
  $pathShape.AddArc($rect.X, $rect.Bottom - $diameter, $diameter, $diameter, 90, 90)
  $pathShape.CloseFigure()

  $blue = [System.Drawing.Drawing2D.LinearGradientBrush]::new($rect, [System.Drawing.Color]::FromArgb(23, 119, 255), [System.Drawing.Color]::FromArgb(18, 49, 151), 45)
  $graphics.FillPath($blue, $pathShape)

  $chartLeft = [int]($Size * 0.25)
  $chartBottom = [int]($Size * 0.75)
  $barWidth = [int]($Size * 0.12)
  $gap = [int]($Size * 0.055)
  $heights = @([int]($Size * 0.23), [int]($Size * 0.39), [int]($Size * 0.55))
  $colors = @([System.Drawing.Color]::FromArgb(255, 122, 10), [System.Drawing.Color]::FromArgb(255, 190, 22), [System.Drawing.Color]::FromArgb(32, 194, 92))
  for ($i = 0; $i -lt 3; $i++) {
    $x = $chartLeft + $i * ($barWidth + $gap)
    $height = $heights[$i]
    $barRect = [System.Drawing.Rectangle]::new($x, $chartBottom - $height, $barWidth, $height)
    $barPath = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $barRadius = [Math]::Max(2, [int]($Size * 0.025))
    $barDiameter = $barRadius * 2
    $barPath.AddArc($barRect.X, $barRect.Y, $barDiameter, $barDiameter, 180, 90)
    $barPath.AddArc($barRect.Right - $barDiameter, $barRect.Y, $barDiameter, $barDiameter, 270, 90)
    $barPath.AddLine($barRect.Right, $barRect.Bottom, $barRect.X, $barRect.Bottom)
    $barPath.CloseFigure()
    $brush = [System.Drawing.SolidBrush]::new($colors[$i])
    $graphics.FillPath($brush, $barPath)
    $brush.Dispose()
    $barPath.Dispose()
  }

  $directory = Split-Path -Parent $Path
  if (-not (Test-Path -LiteralPath $directory)) { New-Item -ItemType Directory -Path $directory | Out-Null }
  $bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
  $blue.Dispose(); $pathShape.Dispose(); $graphics.Dispose(); $bitmap.Dispose()
}

$web = Join-Path $Root "apps\web"
New-VtaPosIcon 1024 (Join-Path $web "public\vta-pos-icon.png")
New-VtaPosIcon 1024 (Join-Path $web "ios\App\App\Assets.xcassets\AppIcon.appiconset\AppIcon-512@2x.png")

$androidSizes = @{
  "mipmap-mdpi" = 48
  "mipmap-hdpi" = 72
  "mipmap-xhdpi" = 96
  "mipmap-xxhdpi" = 144
  "mipmap-xxxhdpi" = 192
}
foreach ($entry in $androidSizes.GetEnumerator()) {
  $folder = Join-Path $web "android\app\src\main\res\$($entry.Key)"
  New-VtaPosIcon $entry.Value (Join-Path $folder "ic_launcher.png")
  New-VtaPosIcon $entry.Value (Join-Path $folder "ic_launcher_round.png")
}

Write-Host "Icônes VTA POS générées."
