// One conversation: live message list + input. Opened as a full-screen modal
// from the service page (customer) or from the messages list (both sides).
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator, FlatList, KeyboardAvoidingView, Modal, Platform, StyleSheet, Text,
    TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/brand';
import { IconButton } from '@/components/ui/IconButton';
import type { Language } from '@/app/(tabs)/index';
import {
    type ChatRole, type Message, MAX_MESSAGE_LENGTH,
    fetchMessages, markConversationRead, sendMessage, subscribeToMessages,
} from '@/lib/chat';
import { CHAT_TEXT, formatChatTime } from './chatText';

type Props = {
    visible: boolean;
    conversationId: number | null;
    userId: string;
    role: ChatRole;
    title: string;
    lang: Language;
    onClose: () => void;
};

export default function ChatThread({ visible, conversationId, userId, role, title, lang, onClose }: Props) {
    const t = CHAT_TEXT[lang];
    const insets = useSafeAreaInsets();
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(true);
    const [draft, setDraft] = useState('');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');
    const listRef = useRef<FlatList<Message>>(null);

    const addMessage = useCallback((m: Message) => {
        setMessages(prev => (prev.some(x => x.id === m.id) ? prev : [...prev, m]));
    }, []);

    useEffect(() => {
        if (!visible || !conversationId) return;
        let alive = true;
        setLoading(true);
        setError('');
        fetchMessages(conversationId)
            .then(list => { if (alive) setMessages(list); })
            .catch(() => { if (alive) setMessages([]); })
            .finally(() => { if (alive) setLoading(false); });
        markConversationRead(conversationId);

        const unsubscribe = subscribeToMessages(conversationId, m => {
            addMessage(m);
            if (m.sender_id !== userId) markConversationRead(conversationId);
        });
        return () => { alive = false; unsubscribe(); };
    }, [visible, conversationId, userId, addMessage]);

    useEffect(() => {
        if (messages.length) requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    }, [messages.length]);

    const handleSend = async () => {
        const text = draft.trim();
        if (!text || sending || !conversationId) return;
        setSending(true);
        setError('');
        try {
            const m = await sendMessage(conversationId, userId, text);
            addMessage(m);
            setDraft('');
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } catch {
            setError(t.failed);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } finally {
            setSending(false);
        }
    };

    const renderItem = ({ item }: { item: Message }) => {
        const mine = item.sender_id === userId;
        return (
            <View style={[styles.bubbleRow, mine ? styles.rowMine : styles.rowTheirs]}>
                <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                    <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{item.body}</Text>
                    <Text style={[styles.time, mine && styles.timeMine]}>{formatChatTime(item.created_at, lang)}</Text>
                </View>
            </View>
        );
    };

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen">
            <View style={[styles.root, { paddingTop: insets.top + 6 }]}>
                <View style={styles.header}>
                    <IconButton icon="chevron-left" onPress={onClose} />
                    <View style={styles.headerText}>
                        <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
                        <Text style={styles.headerSub}>{role === 'customer' ? 'Toy Olsun' : t.customer}</Text>
                    </View>
                    <View style={{ width: 34 }} />
                </View>

                <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                    {loading ? (
                        <ActivityIndicator color={Colors.gold} style={{ marginTop: 40 }} />
                    ) : (
                        <FlatList
                            ref={listRef}
                            data={messages}
                            keyExtractor={m => String(m.id)}
                            renderItem={renderItem}
                            contentContainerStyle={styles.list}
                            ListEmptyComponent={role === 'customer' ? <Text style={styles.hint}>{t.firstHint}</Text> : undefined}
                            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
                            keyboardShouldPersistTaps="handled"
                        />
                    )}

                    {error ? <Text style={styles.error}>{error}</Text> : null}

                    <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
                        <TextInput
                            style={styles.input}
                            value={draft}
                            onChangeText={setDraft}
                            placeholder={t.placeholder}
                            placeholderTextColor={Colors.textPlaceholder}
                            multiline
                            maxLength={MAX_MESSAGE_LENGTH}
                        />
                        <TouchableOpacity
                            style={[styles.sendBtn, (!draft.trim() || sending) && styles.sendBtnOff]}
                            onPress={handleSend}
                            disabled={!draft.trim() || sending}
                            accessibilityLabel={t.send}
                        >
                            {sending ? <ActivityIndicator color={Colors.white} size="small" /> : <Feather name="send" size={18} color={Colors.white} />}
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#F7F3EE' },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E2D9CF' },
    headerText: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
    headerTitle: { fontSize: 16.5, fontWeight: '600', color: Colors.ink },
    headerSub: { fontSize: 12, color: Colors.textMuted, marginTop: 1 },
    list: { padding: 14, paddingBottom: 8, flexGrow: 1 },
    hint: { textAlign: 'center', color: Colors.textMuted, fontSize: 13.5, lineHeight: 20, marginTop: 30, paddingHorizontal: 24 },
    bubbleRow: { flexDirection: 'row', marginVertical: 3 },
    rowMine: { justifyContent: 'flex-end' },
    rowTheirs: { justifyContent: 'flex-start' },
    bubble: { maxWidth: '80%', borderRadius: 18, paddingHorizontal: 13, paddingVertical: 8 },
    bubbleMine: { backgroundColor: Colors.ink, borderBottomRightRadius: 6 },
    bubbleTheirs: { backgroundColor: Colors.white, borderBottomLeftRadius: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: '#E2D9CF' },
    bubbleText: { fontSize: 15, lineHeight: 20, color: Colors.ink },
    bubbleTextMine: { color: Colors.white },
    time: { fontSize: 10.5, color: Colors.textMuted, marginTop: 3, alignSelf: 'flex-end' },
    timeMine: { color: '#CFC5BB' },
    error: { color: Colors.danger, fontSize: 12.5, textAlign: 'center', paddingVertical: 4 },
    inputBar: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingTop: 8, backgroundColor: Colors.white, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E2D9CF' },
    input: { flex: 1, minHeight: 42, maxHeight: 120, backgroundColor: '#F4EFE9', borderRadius: 21, paddingHorizontal: 16, paddingTop: 11, paddingBottom: 11, fontSize: 15, color: Colors.ink },
    sendBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: Colors.gold, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
    sendBtnOff: { opacity: 0.45 },
});
