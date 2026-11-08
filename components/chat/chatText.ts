import type { Language } from '@/app/(tabs)/index';

export const CHAT_TEXT: Record<Language, {
    messages: string; writeBtn: string; placeholder: string; send: string; empty: string; emptySub: string;
    emptyPartnerSub: string; firstHint: string; loginToWrite: string; failed: string; today: string; yesterday: string;
    customer: string; you: string;
}> = {
    az: {
        messages: 'Mesajlar', writeBtn: 'Yaz', placeholder: 'Mesaj yazın…', send: 'Göndər',
        empty: 'Hələ mesaj yoxdur', emptySub: 'Xidmət səhifəsində "Yaz" düyməsinə basıb partnyorla birbaşa danışın.',
        emptyPartnerSub: 'Müştərilər sizə tətbiqdən yazanda mesajlar burada görünəcək.',
        firstHint: 'Salam! Tarix, qonaq sayı və suallarınızı yazın, partnyor burada cavab verəcək.',
        loginToWrite: 'Yazmaq üçün hesaba daxil olun', failed: 'Göndərilmədi. Yenidən cəhd edin.',
        today: 'Bu gün', yesterday: 'Dünən', customer: 'Müştəri', you: 'Siz',
    },
    ru: {
        messages: 'Сообщения', writeBtn: 'Написать', placeholder: 'Напишите сообщение…', send: 'Отправить',
        empty: 'Сообщений пока нет', emptySub: 'Нажмите «Написать» на странице услуги, чтобы связаться с партнёром напрямую.',
        emptyPartnerSub: 'Когда клиенты напишут вам из приложения, сообщения появятся здесь.',
        firstHint: 'Здравствуйте! Укажите дату, число гостей и вопросы — партнёр ответит здесь.',
        loginToWrite: 'Войдите, чтобы написать', failed: 'Не отправлено. Попробуйте снова.',
        today: 'Сегодня', yesterday: 'Вчера', customer: 'Клиент', you: 'Вы',
    },
    en: {
        messages: 'Messages', writeBtn: 'Message', placeholder: 'Write a message…', send: 'Send',
        empty: 'No messages yet', emptySub: 'Tap "Message" on a service page to talk to the partner directly.',
        emptyPartnerSub: 'When customers write to you from the app, messages will appear here.',
        firstHint: 'Hi! Share your date, guest count and questions — the partner will reply here.',
        loginToWrite: 'Sign in to send a message', failed: 'Not sent. Please try again.',
        today: 'Today', yesterday: 'Yesterday', customer: 'Customer', you: 'You',
    },
};

export function formatChatTime(iso: string, lang: Language): string {
    const d = new Date(iso);
    const now = new Date();
    const hhmm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const sameDay = d.toDateString() === now.toDateString();
    if (sameDay) return hhmm;
    const y = new Date(now); y.setDate(now.getDate() - 1);
    if (d.toDateString() === y.toDateString()) return `${CHAT_TEXT[lang].yesterday} ${hhmm}`;
    return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')} ${hhmm}`;
}
