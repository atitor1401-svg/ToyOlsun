// "Messages" section for the customer and partner dashboards: live list of
// conversations with unread badges; tapping one opens the thread.
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors } from '@/constants/brand';
import type { Language } from '@/app/(tabs)/index';
import { type ChatRole, type Conversation, listConversations, subscribeToConversations, unreadFor } from '@/lib/chat';
import ChatThread from './ChatThread';
import { CHAT_TEXT, formatChatTime } from './chatText';

type Props = { role: ChatRole; userId: string; lang: Language; showTitle?: boolean };

export default function ConversationList({ role, userId, lang, showTitle = true }: Props) {
    const t = CHAT_TEXT[lang];
    const [items, setItems] = useState<Conversation[]>([]);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState<Conversation | null>(null);

    const refresh = useCallback(() => {
        listConversations(role, userId)
            .then(setItems)
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [role, userId]);

    useEffect(() => {
        refresh();
        return subscribeToConversations(role, userId, refresh);
    }, [role, userId, refresh]);

    return (
        <View style={styles.section}>
            {showTitle && <Text style={styles.title}>{t.messages}</Text>}
            {loading ? (
                <ActivityIndicator color={Colors.gold} style={{ marginVertical: 16 }} />
            ) : items.length === 0 ? (
                <View style={styles.empty}>
                    <Feather name="message-circle" size={22} color={Colors.textMuted} />
                    <Text style={styles.emptyTitle}>{t.empty}</Text>
                    <Text style={styles.emptySub}>{role === 'customer' ? t.emptySub : t.emptyPartnerSub}</Text>
                </View>
            ) : (
                items.map(c => {
                    const unread = unreadFor(c, role);
                    return (
                        <TouchableOpacity key={c.id} style={styles.row} activeOpacity={0.75} onPress={() => setOpen(c)}>
                            <View style={styles.avatar}>
                                <Feather name={role === 'customer' ? 'briefcase' : 'user'} size={17} color={Colors.gold} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <View style={styles.rowTop}>
                                    <Text style={[styles.name, unread > 0 && styles.bold]} numberOfLines={1}>
                                        {role === 'customer' ? (c.service_title || 'Toy Olsun') : `${t.customer} · ${c.service_title || ''}`}
                                    </Text>
                                    <Text style={styles.time}>{formatChatTime(c.last_message_at, lang)}</Text>
                                </View>
                                <View style={styles.rowTop}>
                                    <Text style={[styles.preview, unread > 0 && styles.previewUnread]} numberOfLines={1}>
                                        {c.last_message || '…'}
                                    </Text>
                                    {unread > 0 && (
                                        <View style={styles.badge}><Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text></View>
                                    )}
                                </View>
                            </View>
                        </TouchableOpacity>
                    );
                })
            )}

            <ChatThread
                visible={!!open}
                conversationId={open?.id ?? null}
                userId={userId}
                role={role}
                title={open?.service_title || 'Toy Olsun'}
                lang={lang}
                onClose={() => { setOpen(null); refresh(); }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    section: { marginTop: 18 },
    title: { fontSize: 18, fontWeight: '600', color: Colors.ink, marginBottom: 10 },
    empty: { alignItems: 'center', backgroundColor: Colors.white, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: Colors.border },
    emptyTitle: { fontSize: 14.5, fontWeight: '600', color: Colors.ink, marginTop: 8 },
    emptySub: { fontSize: 12.5, color: Colors.textMuted, textAlign: 'center', marginTop: 4, lineHeight: 18 },
    row: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderRadius: 16, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: Colors.border },
    avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F6EFDD', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    name: { flex: 1, fontSize: 14.5, color: Colors.ink, marginRight: 8 },
    bold: { fontWeight: '700' },
    time: { fontSize: 11.5, color: Colors.textMuted },
    preview: { flex: 1, fontSize: 13, color: Colors.textMuted, marginTop: 3, marginRight: 8 },
    previewUnread: { color: Colors.ink, fontWeight: '600' },
    badge: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: Colors.gold, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, marginTop: 3 },
    badgeText: { fontSize: 11, fontWeight: '700', color: Colors.ink },
});
