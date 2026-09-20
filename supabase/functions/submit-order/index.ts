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

interface PromoInfo { code: string; percent: number; eligible: Set<string> }

// Re-checks the promo code and which services have the promo switched on, so
// the Telegram message reflects the server's view rather than the app's.
// Any failure just means "no promo line" — it must never block the order.
async function resolvePromo(code: unknown, cart: any[]): Promise<PromoInfo | null> {
  if (typeof code !== 'string' || !code.trim()) return null;
  const baseUrl = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!baseUrl || !key) return null;
  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  try {
    const rpc = await fetch(`${baseUrl}/rest/v1/rpc/validate_promo`, {
      method: 'POST', headers, body: JSON.stringify({ p_code: code }),
    });
    const percent = rpc.ok ? Number(await rpc.json()) : 0;
    if (!(percent > 0)) return null;

    const ids = (cart || []).map((i: any) => String(i?.id ?? '')).filter((id: string) => /^\d+$/.test(id));
    if (ids.length === 0) return null;
    const res = await fetch(`${baseUrl}/rest/v1/service?select=id,promo_active&id=in.(${ids.join(',')})`, { headers });
    if (!res.ok) return null;
    const rows: { id: number; promo_active: boolean }[] = await res.json();
    const eligible = new Set(rows.filter((r) => r.promo_active).map((r) => String(r.id)));
    return eligible.size > 0 ? { code: code.trim().toUpperCase().slice(0, 30), percent, eligible } : null;
  } catch (e) {
    console.error('Promo lookup failed:', (e as Error).message);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { fullName, phone, eventDate, guests, cart, totalEstimate, lang, orderRef, promoCode } = await req.json();
    const promo = await resolvePromo(promoCode, cart);
    const isPromoItem = (i: any) => !!promo && promo.eligible.has(String(i?.id));

    const TELEGRAM_TOKEN = Deno.env.get('TELEGRAM_TOKEN');
    const TELEGRAM_CHAT_ID = Deno.env.get('TELEGRAM_CHAT_ID');

    // orderRef lets a retried delivery be recognised as the same order.
    const refLine = orderRef ? `\n\n🔖 ${String(orderRef).slice(0, 40)}` : '';
    const promoLine = promo ? `\n🎟 Promo: ${promo.code} (−${promo.percent}%)` : '';
    const text = `🎊 YENİ SİFARİŞ (${(lang || 'az').toUpperCase()})!\n\n👤 Ad Soyad: ${fullName || 'Qeyd edilməyib'}\n📞 Telefon: ${phone || 'Qeyd edilməyib'}\n📅 Tarix: ${eventDate}\n👥 Qonaq: ${guests}\n💰 Məbləğ: ${totalEstimate} AZN${promoLine}\n\n🛒 Seçilənlər:\n${(cart || []).map((i: any) => `• ${i.title}${isPromoItem(i) ? ` (−${promo!.percent}%)` : ''}`).join('\n')}${refLine}`;

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
      const basePrice = item.category === 'venues' ? item.price * guests : item.price;
      const promoItem = isPromoItem(item);
      const finalPrice = promoItem ? Math.round(basePrice * (100 - promo!.percent) / 100) : basePrice;
      const vendorPromo = promoItem ? `\n🎟 Promo: ${promo!.code} (−${promo!.percent}%)` : '';
      const vendorText = `🎊 YENİ SİFARİŞ!\n\n👤 ${fullName || 'Qeyd edilməyib'}\n📞 ${phone || 'Qeyd edilməyib'}\n📅 ${eventDate}\n👥 ${guests} qonaq\n💰 ${finalPrice} AZN${vendorPromo}\n\n✅ Xidmət: ${item.title}`;
      await sendTelegram(TELEGRAM_TOKEN, String(item.telegram_chat_id), vendorText);
    }));

    return new Response(
      JSON.stringify({ success: true, promoApplied: !!promo }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
