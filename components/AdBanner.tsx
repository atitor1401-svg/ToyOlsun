import React, { useEffect, useState } from 'react';
import { Image, Linking, StyleSheet, TouchableOpacity, View } from 'react-native';
import { supabase } from '@/lib/supabase';

export function AdBanner() {
    const [banner, setBanner] = useState<{ id: string; image_url: string; link_url: string | null } | null>(null);

    useEffect(() => {
        let mounted = true;
        supabase
            .from('banners')
            .select('id, image_url, link_url')
            .eq('active', true)
            .order('sort_order', { ascending: true })
            .limit(1)
            .then(({ data }) => {
                if (mounted && data && data.length > 0) setBanner(data[0]);
            });
        return () => { mounted = false; };
    }, []);

    if (!banner) return null;

    const content = (
        <Image source={{ uri: banner.image_url }} style={styles.adBannerImage} resizeMode="cover" />
    );

    return (
        <View style={styles.adBannerWrap}>
            {banner.link_url ? (
                <TouchableOpacity activeOpacity={0.85} onPress={() => Linking.openURL(banner.link_url!)}>
                    {content}
                </TouchableOpacity>
            ) : content}
        </View>
    );
}

const styles = StyleSheet.create({
    adBannerWrap: { marginTop: 24, borderRadius: 14, overflow: 'hidden', backgroundColor: '#EFECE6' },
    adBannerImage: { width: '100%', aspectRatio: 16 / 9 },
});
