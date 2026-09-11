$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing

$projectRoot = Split-Path -Parent $PSScriptRoot
$mascotDir = Join-Path $projectRoot 'public\mascot'

function Export-CroppedPng {
  param(
    [Parameter(Mandatory)] [string] $Source,
    [Parameter(Mandatory)] [string] $Output,
    [Parameter(Mandatory)] [int] $CropX,
    [Parameter(Mandatory)] [int] $CropY,
    [Parameter(Mandatory)] [int] $CropWidth,
    [Parameter(Mandatory)] [int] $CropHeight,
    [Parameter(Mandatory)] [int] $TargetWidth,
    [Parameter(Mandatory)] [int] $TargetHeight
  )

  $sourcePath = Join-Path $mascotDir $Source
  $outputPath = Join-Path $mascotDir $Output
  $sourceImage = [System.Drawing.Bitmap]::FromFile($sourcePath)
  try {
    $target = New-Object System.Drawing.Bitmap($TargetWidth, $TargetHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    try {
      $target.SetResolution(96, 96)
      $graphics = [System.Drawing.Graphics]::FromImage($target)
      try {
        $graphics.Clear([System.Drawing.Color]::Transparent)
        $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
        $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality

        $scale = [Math]::Min(($TargetWidth - 12) / $CropWidth, ($TargetHeight - 12) / $CropHeight)
        $drawWidth = [int][Math]::Round($CropWidth * $scale)
        $drawHeight = [int][Math]::Round($CropHeight * $scale)
        $drawX = [int][Math]::Round(($TargetWidth - $drawWidth) / 2)
        $drawY = [int][Math]::Round(($TargetHeight - $drawHeight) / 2)
        $destination = New-Object System.Drawing.Rectangle($drawX, $drawY, $drawWidth, $drawHeight)
        $sourceRect = New-Object System.Drawing.Rectangle($CropX, $CropY, $CropWidth, $CropHeight)
        $graphics.DrawImage($sourceImage, $destination, $sourceRect, [System.Drawing.GraphicsUnit]::Pixel)
      }
      finally {
        $graphics.Dispose()
      }
      $target.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    }
    finally {
      $target.Dispose()
    }
  }
  finally {
    $sourceImage.Dispose()
  }
}

$characters = @(
  @{ Source = 'penguin-classes-feminine-v2.png'; Output = 'penguin-feminine-cpu.png'; X = 8; Width = 492 },
  @{ Source = 'penguin-classes-feminine-v2.png'; Output = 'penguin-feminine-soc.png'; X = 505; Width = 580 },
  @{ Source = 'penguin-classes-feminine-v2.png'; Output = 'penguin-feminine-dft.png'; X = 1125; Width = 470 },
  @{ Source = 'penguin-classes-feminine-v2.png'; Output = 'penguin-feminine-timing.png'; X = 1600; Width = 569 },
  @{ Source = 'penguin-classes-masculine.png'; Output = 'penguin-masculine-cpu.png'; X = 0; Width = 525 },
  @{ Source = 'penguin-classes-masculine.png'; Output = 'penguin-masculine-soc.png'; X = 505; Width = 570 },
  @{ Source = 'penguin-classes-masculine.png'; Output = 'penguin-masculine-dft.png'; X = 1135; Width = 475 },
  @{ Source = 'penguin-classes-masculine.png'; Output = 'penguin-masculine-timing.png'; X = 1625; Width = 546 },
  @{ Source = 'penguin-evolution.png'; Output = 'penguin-masculine-novice.png'; X = 75; Width = 460 },
  @{ Source = 'penguin-evolution.png'; Output = 'penguin-feminine-novice.png'; X = 630; Width = 410 }
)

foreach ($character in $characters) {
  Export-CroppedPng -Source $character.Source -Output $character.Output -CropX $character.X -CropY 0 -CropWidth $character.Width -CropHeight 725 -TargetWidth 360 -TargetHeight 480
}

for ($index = 0; $index -lt 3; $index++) {
  $name = @('visor', 'crystal', 'drone')[$index]
  Export-CroppedPng -Source 'penguin-equipment.png' -Output "equipment-$name.png" -CropX ($index * 724) -CropY 0 -CropWidth 724 -CropHeight 724 -TargetWidth 256 -TargetHeight 256
}

Export-CroppedPng -Source 'gate-level-timing-boss.png' -Output 'gate-level-timing-boss-display.png' -CropX 0 -CropY 0 -CropWidth 1312 -CropHeight 1199 -TargetWidth 560 -TargetHeight 512
Export-CroppedPng -Source 'rtl-training-dummy.png' -Output 'rtl-training-dummy-display.png' -CropX 0 -CropY 0 -CropWidth 1254 -CropHeight 1254 -TargetWidth 360 -TargetHeight 360

Write-Output 'Prepared lightweight mascot display assets.'
