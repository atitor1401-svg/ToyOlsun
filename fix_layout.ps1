$path = 'app\_layout.tsx'
$content = Get-Content $path -Raw

$old = "import 'react-native-reanimated';"
$new = "import 'react-native-reanimated';`r`nimport { SafeAreaProvider } from 'react-native-safe-area-context';"

if (-not $content.Contains($old)) {
    Write-Host "XETA: import sətri tapılmadı"
    exit
}
$content = $content.Replace($old, $new)

$old2 = "    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>`r`n      <Stack>"
$new2 = "    <SafeAreaProvider>`r`n    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>`r`n      <Stack>"

if (-not $content.Contains($old2)) {
    Write-Host "XETA: ThemeProvider acilish tapılmadı"
    exit
}
$content = $content.Replace($old2, $new2)

$old3 = "      <StatusBar style=`"auto`" />`r`n    </ThemeProvider>"
$new3 = "      <StatusBar style=`"auto`" />`r`n    </ThemeProvider>`r`n    </SafeAreaProvider>"

if (-not $content.Contains($old3)) {
    Write-Host "XETA: ThemeProvider baglanish tapılmadı"
    exit
}
$content = $content.Replace($old3, $new3)

Set-Content -Path $path -Value $content -NoNewline
Write-Host "UGURLA DEYISDIRILDI"