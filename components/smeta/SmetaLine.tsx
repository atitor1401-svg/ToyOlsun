// One service in the estimate: photo, category, name, how the price is
// counted, the line total and a remove button.
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { premiumStyles } from '@/lib/typography';
import { scaled } from '@/lib/responsive';

interface Props {
    photo?: string;
    category: string;
    title: string;
    detail: string;
    promo?: string;
    price: string;
    onPress?: () => void;
    onRemove: () => void;
}

export default function SmetaLine({ photo, category, title, detail, promo, price, onPress, onRemove }: Props) {
    return (
        <TouchableOpacity style={styles.row} activeOpacity={onPress ? 0.85 : 1} disabled={!onPress} onPress={onPress}>
            <View style={styles.photo}>
                {photo ? (
                    <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
                ) : (
                    <Feather name="image" size={18} color="#C9BFB3" />
                )}
            </View>
            <View style={styles.body}>
                <Text style={styles.category} numberOfLines={1} maxFontSizeMultiplier={1.1}>{category}</Text>
                <Text style={styles.title} numberOfLines={2} maxFontSizeMultiplier={1.15}>{title}</Text>
                <Text style={styles.detail} numberOfLines={1} maxFontSizeMultiplier={1.1}>{detail}</Text>
                {promo ? (
                    <View style={styles.promo}>
                        <Feather name="tag" size={10} color="#8A6D1F" />
                        <Text style={styles.promoText} numberOfLines={1} maxFontSizeMultiplier={1.1}>{promo}</Text>
                    </View>
                ) : null}
            </View>
            <View style={styles.side}>
                <TouchableOpacity onPress={onRemove} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={styles.remove} accessibilityRole="button">
                    <Feather name="x" size={14} color="#8A7E75" />
                </TouchableOpacity>
                <Text style={styles.price} numberOfLines={1} maxFontSizeMultiplier={1.1}>{price}</Text>
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create(premiumStyles(scaled({
    row: { flexDirection: 'row', alignItems: 'stretch', backgroundColor: '#FFF', borderRadius: 18, borderWidth: 1, borderColor: '#EDE6DC', padding: 10, marginBottom: 10 },
    photo: { width: 74, height: 74, borderRadius: 14, overflow: 'hidden', backgroundColor: '#F3EEE7', alignItems: 'center', justifyContent: 'center' },
    body: { flex: 1, marginLeft: 12, justifyContent: 'center' },
    category: { fontSize: 10, fontWeight: '600', color: '#A8893E', letterSpacing: 1.4, textTransform: 'uppercase' },
    title: { fontSize: 17, fontFamily: 'Georgia', fontWeight: '600', color: '#1F1A17', marginTop: 2, lineHeight: 21 },
    detail: { fontSize: 12, color: '#8A7E75', marginTop: 3 },
    promo: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginTop: 5, paddingVertical: 2, paddingHorizontal: 7, borderRadius: 999, backgroundColor: '#FBF4E2' },
    promoText: { fontSize: 10.5, fontWeight: '600', color: '#8A6D1F' },
    side: { alignItems: 'flex-end', justifyContent: 'space-between', marginLeft: 8, paddingVertical: 2 },
    remove: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F1EB' },
    price: { fontSize: 14, fontWeight: '600', color: '#1F1A17' },
})));
