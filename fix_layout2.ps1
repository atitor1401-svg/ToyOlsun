$path = 'app\_layout.tsx'
$content = Get-Content $path -Raw

if ($content -notmatch "SafeAreaProvider") {
    $content = $content -replace "(import 'react-native-reanimated';)", "`$1`r`nimport { SafeAreaProvider } from 'react-native-safe-area-context';"
    Write-Host "1. Import elave edildi"
} else {
    Write-Host "1. Import artiq var, kecirik"
}

$pattern2 = "(<ThemeProvider value=\{colorScheme)"
if ($content -match $pattern2) {
    $content = $content -replace $pattern2, "<SafeAreaProvider>`r`n    `$1"
    Write-Host "2. Acilish elave edildi"
} else {
    Write-Host "2. XETA: ThemeProvider acilish tapilmadi"
    exit
}

$pattern3 = "(</ThemeProvider>)(\s*\);)"
if ($content -match $pattern3) {
    $content = $content -replace $pattern3, "`$1`r`n    </SafeAreaProvider>`$2"
    Write-Host "3. Baglanish elave edildi"
} else {
    Write-Host "3. XETA: baglanish tapilmadi"
    exit
}

Set-Content -Path $path -Value $content -NoNewline
Write-Host "UGURLA DEYISDIRILDI"