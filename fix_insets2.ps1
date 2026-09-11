$path = 'app\(tabs)\index.tsx'
$content = Get-Content $path -Raw

$old2 = "export default function LuxuryApp() {"
if ($content -notmatch [regex]::Escape($old2)) {
    Write-Host "XETA: komponent basi tapilmadi"
    exit
}
$new2 = "export default function LuxuryApp() {`r`n    const insets = useSafeAreaInsets();"
$content = $content.Replace($old2, $new2)
Write-Host "2. Hook elave edildi"

$old3 = "<View style={styles.topHeader}>"
if ($content -notmatch [regex]::Escape($old3)) {
    Write-Host "XETA: topHeader tapilmadi"
    exit
}
$new3 = "<View style={[styles.topHeader, Platform.OS === 'android' && { paddingTop: insets.top + 10 }]}>"
$content = $content.Replace($old3, $new3)
Write-Host "3. topHeader deyisdirildi"

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