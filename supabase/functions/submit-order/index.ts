import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TELEGRAM_TEXT_LIMIT = 4000; // Telegram rejects messages over 4096 chars
const MAX_ATTEMPTS = 3;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Sends one Telegram message, retrying on rate limits (429), server errors
// and network failures. Never throws — returns whether it was delivered.
async function sendTelegram(token: string | undefined, chatId: string | undefined, text: string): Promise<boolean> {
  if (!token || !chatId) {
    console.error('Telegram not configured: missing token or chat id');
    return false;
  }
  const safeText = text.length > TELEGRAM_TEXT_LIMIT ? text.slice(0, TELEGRAM_TEXT_LIMIT - 1) + '…' : text;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: safeText }),
      });
      if (res.ok) return true;

      const detail = await res.text().catch(() => '');
      console.error(`Telegram attempt ${attempt} failed: ${res.status} ${detail.slice(0, 200)}`);

      if (res.status === 429) {
        let waitMs = 1000;
        try { waitMs = Math.min((JSON.parse(detail)?.parameters?.retry_after ?? 1) * 1000, 4000); } catch { /* keep default */ }
        if (attempt < MAX_ATTEMPTS) await sleep(waitMs);
        continue;
      }
      // Other 4xx (bad chat id, blocked bot, ...) will not succeed on retry.
      if (res.status >= 400 && res.status < 500) return false;
    } catch (e) {
      console.error(`Telegram attempt ${attempt} network error:`, (e as Error).message);
    }
    if (attempt < MAX_ATTEMPTS) await sleep(500 * attempt);
  }
  return false;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { fullName, phone, eventDate, guests, cart, totalEstimate, lang, orderRef } = await req.json();

    const TELEGRAM_TOKEN = Deno.env.get('TELEGRAM_TOKEN');
    const TELEGRAM_CHAT_ID = Deno.env.get('TELEGRAM_CHAT_ID');

    // orderRef lets a retried delivery be recognised as the same order.
    const refLine = orderRef ? `\n\n🔖 ${String(orderRef).slice(0, 40)}` : '';
    const text = `🎊 YENİ SİFARİŞ (${(lang || 'az').toUpperCase()})!\n\n👤 Ad Soyad: ${fullName || 'Qeyd edilməyib'}\n📞 Telefon: ${phone || 'Qeyd edilməyib'}\n📅 Tarix: ${eventDate}\n👥 Qonaq: ${guests}\n💰 Məbləğ: ${totalEstimate} AZN\n\n🛒 Seçilənlər:\n${(cart || []).map((i: any) => `• ${i.title}`).join('\n')}${refLine}`;

    const mainOk = await sendTelegram(TELEGRAM_TOKEN, TELEGRAM_CHAT_ID, text);
    if (!mainOk) {
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to send main notification' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Partner notifications are best-effort and must never make the whole
    // call fail (the admin message above is already delivered).
    await Promise.all((cart || []).map(async (item: any) => {
      if (!item.telegram_chat_id) return;
      const vendorText = `🎊 YENİ SİFARİŞ!\n\n👤 ${fullName || 'Qeyd edilməyib'}\n📞 ${phone || 'Qeyd edilməyib'}\n📅 ${eventDate}\n👥 ${guests} qonaq\n💰 ${item.category === 'venues' ? item.price * guests : item.price} AZN\n\n✅ Xidmət: ${item.title}`;
      await sendTelegram(TELEGRAM_TOKEN, String(item.telegram_chat_id), vendorText);
    }));

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
