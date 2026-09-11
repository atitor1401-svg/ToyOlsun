$path = 'app\(tabs)\index.tsx'
$content = Get-Content $path -Raw

$before1 = $content
$content = $content -replace "SafeAreaView,\s*PanResponder", "PanResponder"
if ($content -eq $before1) {
    Write-Host "XETA: 1-ci deyisiklik tapilmadi"
    exit
}

$pattern = "\} from 'react-native';"
$matches = [regex]::Matches($content, $pattern)
Write-Host "Tapilan uygunluq sayi: $($matches.Count)"

$content = $content -replace $pattern, "} from 'react-native';`r`nimport { SafeAreaView } from 'react-native-safe-area-context';", 1

Set-Content -Path $path -Value $content -NoNewline
Write-Host "UGURLA DEYISDIRILDI"