$path = 'app\(tabs)\index.tsx'
$content = Get-Content $path -Raw

# 1. useSafeAreaInsets import elave et
$old1 = "import { SafeAreaView } from 'react-native-safe-area-context';"
if ($content -notmatch [regex]::Escape($old1)) {
    Write-Host "XETA: SafeAreaView importu tapilmadi"
    exit
}
$new1 = "import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';"
$content = $content.Replace($old1, $new1)
Write-Host "1. Import deyisdirildi"

# 2. Hook-u komponentin icinde cagiraq
$old2 = "export default function LuxuryApp() {`r`n    const [lang, setLang] = useState<Language>('az');"
if ($content -notmatch [regex]::Escape($old2)) {
    Write-Host "XETA: komponent basi tapilmadi"
    exit
}
$new2 = "export default function LuxuryApp() {`r`n    const insets = useSafeAreaInsets();`r`n    const [lang, setLang] = useState<Language>('az');"
$content = $content.Replace($old2, $new2)
Write-Host "2. Hook elave edildi"

# 3. topHeader-e dinamik paddingTop elave edek (yalniz Android)
$old3 = "<View style={styles.topHeader}>"
if ($content -notmatch [regex]::Escape($old3)) {
    Write-Host "XETA: topHeader tapilmadi"
    exit
}
$new3 = "<View style={[styles.topHeader, Platform.OS === 'android' && { paddingTop: insets.top + 10 }]}>"
$content = $content.Replace($old3, $new3)
Write-Host "3. topHeader deyisdirildi"

# 4. tabBar-a dinamik paddingBottom elave edek (yalniz Android)
$old4 = "<View style={styles.tabBar}>"
if ($content -notmatch [regex]::Escape($old4)) {
    Write-Host "XETA: tabBar tapilmadi"
    exit
}
$new4 = "<View style={[styles.tabBar, Platform.OS === 'android' && { paddingBottom: insets.bottom + 10 }]}>"
$content = $content.Replace($old4, $new4)
Write-Host "4. tabBar deyisdirildi"

Set-Content -Path $path -Value $content -NoNewline
Write-Host "UGURLA DEYISDIRILDI"