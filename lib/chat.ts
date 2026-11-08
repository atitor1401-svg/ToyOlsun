// Customer <-> partner chat (tables public.conversations / public.messages).
// Data access only; screens live in components/chat/.
// Security is enforced by RLS + SECURITY DEFINER functions in the database:
// a user only ever sees conversations they take part in.
import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { logServiceEvent } from './serviceEvents';

export type ChatRole = 'customer' | 'partner';

export interface Conversation {
    id: number;
    service_id: number | null;
    customer_id: string;
    partner_id: string;
    service_title: string | null;
    last_message: string | null;
    last_message_at: string;
    customer_unread: number;
    partner_unread: number;
}

export interface Message {
    id: number;
    conversation_id: number;
    sender_id: string;
    body: string;
    created_at: string;
}

export const MAX_MESSAGE_LENGTH = 2000;

// supabase.channel(name) returns the SAME channel when the name is reused, and
// adding listeners to an already-subscribed channel throws. Several screens can
// watch the same data at once (e.g. unread badge + list), so every
// subscription gets its own channel name.
let channelSeq = 0;
const uniqueChannel = (base: string) => `${base}:${++channelSeq}:${Date.now()}`;

export async function startConversation(serviceId: string | number): Promise<number> {
    const { data, error } = await supabase.rpc('start_conversation', { p_service_id: Number(serviceId) });
    if (error) throw error;
    logServiceEvent(serviceId, 'message');
    return data as number;
}

export async function listConversations(role: ChatRole, userId: string): Promise<Conversation[]> {
    const column = role === 'customer' ? 'customer_id' : 'partner_id';
    const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq(column, userId)
        .order('last_message_at', { ascending: false });
    if (error) throw error;
    return (data || []) as Conversation[];
}

export async function getConversation(id: number): Promise<Conversation | null> {
    const { data } = await supabase.from('conversations').select('*').eq('id', id).maybeSingle();
    return (data as Conversation) ?? null;
}

export async function fetchMessages(conversationId: number): Promise<Message[]> {
    const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(500);
    if (error) throw error;
    return (data || []) as Message[];
}

export async function sendMessage(conversationId: number, senderId: string, body: string): Promise<Message> {
    const text = body.trim().slice(0, MAX_MESSAGE_LENGTH);
    if (!text) throw new Error('empty');
    const { data, error } = await supabase
        .from('messages')
        .insert({ conversation_id: conversationId, sender_id: senderId, body: text })
        .select()
        .single();
    if (error) throw error;
    return data as Message;
}

export function markConversationRead(conversationId: number): void {
    supabase.rpc('mark_conversation_read', { p_conversation_id: conversationId }).then(() => {}, () => {});
}

// Live new messages in one conversation. Returns an unsubscribe function.
export function subscribeToMessages(conversationId: number, onMessage: (m: Message) => void): () => void {
    const channel = supabase
        .channel(uniqueChannel(`messages:${conversationId}`))
        .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
            payload => onMessage(payload.new as Message),
        )
        .subscribe();
    return () => { supabase.removeChannel(channel); };
}

// Live changes to the signed-in user's conversation list (new chats, previews, unread).
export function subscribeToConversations(role: ChatRole, userId: string, onChange: () => void): () => void {
    const column = role === 'customer' ? 'customer_id' : 'partner_id';
    const channel = supabase
        .channel(uniqueChannel(`conversations:${role}:${userId}`))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations', filter: `${column}=eq.${userId}` }, () => onChange())
        .subscribe();
    return () => { supabase.removeChannel(channel); };
}

export function unreadFor(c: Conversation, role: ChatRole): number {
    return role === 'customer' ? c.customer_unread : c.partner_unread;
}

// Total unread messages for a badge; live-updating.
export function useUnreadCount(role: ChatRole, userId: string | null): number {
    const [count, setCount] = useState(0);
    useEffect(() => {
        if (!userId) { setCount(0); return; }
        let alive = true;
        const refresh = () => listConversations(role, userId)
            .then(list => { if (alive) setCount(list.reduce((n, c) => n + unreadFor(c, role), 0)); })
            .catch(() => {});
        refresh();
        const unsubscribe = subscribeToConversations(role, userId, refresh);
        return () => { alive = false; unsubscribe(); };
    }, [role, userId]);
    return count;
}
