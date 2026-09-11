$path = 'app\(tabs)\index.tsx'
$content = Get-Content $path -Raw

$old = "import { SafeAreaView } from 'react-native-safe-area-context';"
if ($content -notmatch [regex]::Escape($old)) {
    Write-Host "XETA: mevcud import tapilmadi"
    exit
}
$new = "import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';"
$content = $content.Replace($old, $new)

Set-Content -Path $path -Value $content -NoNewline
Write-Host "UGURLA DEYISDIRILDI"