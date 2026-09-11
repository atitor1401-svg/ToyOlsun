$path = 'app\(tabs)\index.tsx'
$content = Get-Content $path -Raw

if ($content -match "from 'react-native-safe-area-context'") {
    Write-Host "Deyisiklik artiq var, hec ne edilmedi"
    exit
}

$content = $content -replace "SafeAreaView,\s*PanResponder", "PanResponder"

$regex = [regex]"\} from 'react-native';"
$content = $regex.Replace($content, "} from 'react-native';`r`nimport { SafeAreaView } from 'react-native-safe-area-context';", 1)

Set-Content -Path $path -Value $content -NoNewline
Write-Host "UGURLA DEYISDIRILDI"