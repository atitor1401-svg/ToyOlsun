$old = @'
            for (const asset of result.assets) {
                const fileExt = asset.uri.split('.').pop()?.toLowerCase() || 'jpg';
                const fileName = `partners/${folderSlug}/${Date.now()}-${Math.floor(Math.random() * 100000)}.${fileExt}`;
                const contentType = fileExt === 'png' ? 'image/png' : 'image/jpeg';
                const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: 'base64' });
                const { error } = await supabase.storage.from('images').upload(fileName, decode(base64), { contentType, upsert: false });
                if (error) throw error;
                const { data } = supabase.storage.from('images').getPublicUrl(fileName);
                if (data?.publicUrl) uploaded.push(data.publicUrl);
            }
'@

$new = @'
            for (const asset of result.assets) {
                const manipulated = await ImageManipulator.manipulateAsync(asset.uri, [{ resize: { width: 1000 } }], { compress: 0.65, format: ImageManipulator.SaveFormat.JPEG });
                const fileName = `partners/${folderSlug}/${Date.now()}-${Math.floor(Math.random() * 100000)}.jpg`;
                const contentType = 'image/jpeg';
                const base64 = await FileSystem.readAsStringAsync(manipulated.uri, { encoding: 'base64' });
                const { error } = await supabase.storage.from('images').upload(fileName, decode(base64), { contentType, upsert: false });
                if (error) throw error;
                const { data } = supabase.storage.from('images').getPublicUrl(fileName);
                if (data?.publicUrl) uploaded.push(data.publicUrl);
            }
'@

$path = 'app\(tabs)\PartnerPortal.tsx'
$content = Get-Content $path -Raw

if ($content.Contains($old)) {
    $content = $content.Replace($old, $new)
    Set-Content -Path $path -Value $content -NoNewline
    Write-Host "UGURLA DEYISDIRILDI"
} else {
    Write-Host "TAPILMADI - hec bir deyisiklik edilmedi"
}