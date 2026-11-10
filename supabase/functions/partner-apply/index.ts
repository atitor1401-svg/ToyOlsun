// Partner application form (toyolsun.world) → Telegram message to the admin chat.
// Public endpoint: no login. Writes nothing to the database.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const CATEGORIES: Record<string, string> = {
  venues: 'Şadlıq sarayı',
  artists: 'Müğənni / artist',
  dj: 'DJ',
  media: 'Foto / video',
  wedding_dress: 'Gəlinlik salonu',
  flowers: 'Gül dükanı',
  decor: 'Dekor',
  cars: 'Toy maşını / kortej',
  tourism: 'Bal ayı / turizm',
  other: 'Digər',
};

// Simple per-instance limit so one visitor can't flood the chat.
const recent = new Map<string, number[]>();
function tooMany(ip: string): boolean {
  const now = Date.now();
  const list = (recent.get(ip) || []).filter((t) => now - t < 10 * 60_000);
  list.push(now);
  recent.set(ip, list);
  return list.length > 5;
}

const clean = (v: unknown, max: number) =>
  String(v ?? '').replace(/[\u0000-\u001f]+/g, ' ').trim().slice(0, max);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, error: 'method' }, 405);

  try {
    const b = await req.json();
    // Hidden "website" field: real people leave it empty, bots fill it.
    if (clean(b.website, 50)) return json({ ok: true });

    const name = [clean(b.name, 40), clean(b.surname, 40)].filter(Boolean).join(' ');
    const business = clean(b.business, 100);
    const phone = clean(b.phone, 30);
    const category = CATEGORIES[clean(b.category, 30)] ? clean(b.category, 30) : 'other';
    const instagram = clean(b.instagram, 100);
    const city = clean(b.city, 50);
    const price = clean(b.price, 60);
    const note = clean(b.note, 600);
    const lang = clean(b.lang, 5) || 'az';

    if (!business || phone.replace(/\D/g, '').length < 7) return json({ ok: false, error: 'invalid' }, 400);

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
    if (tooMany(ip)) return json({ ok: false, error: 'rate' }, 429);

    const text = [
      `🤝 YENİ PARTNYOR MÜRACİƏTİ (${lang.toUpperCase()})`,
      '',
      `🏷 Biznes: ${business}`,
      `📂 Bölmə: ${CATEGORIES[category]}`,
      `👤 Ad Soyad: ${name || '—'}`,
      `📞 Telefon: ${phone}`,
      `📸 Instagram: ${instagram || '—'}`,
      `📍 Şəhər: ${city || '—'}`,
      `💰 Qiymət: ${price || '—'}`,
      note ? `\n📝 Qeyd: ${note}` : '',
    ].filter((l) => l !== '').join('\n');

    const token = Deno.env.get('TELEGRAM_TOKEN');
    const chatId = Deno.env.get('TELEGRAM_CHAT_ID');
    if (!token || !chatId) return json({ ok: false, error: 'config' }, 500);

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text }),
        });
        if (res.ok) return json({ ok: true });
        console.error('telegram', res.status, (await res.text()).slice(0, 200));
        if (res.status >= 400 && res.status < 500 && res.status !== 429) break;
      } catch (e) {
        console.error('telegram network', (e as Error).message);
      }
      await new Promise((r) => setTimeout(r, 700 * attempt));
    }
    return json({ ok: false, error: 'send' }, 502);
  } catch (e) {
    console.error('partner-apply', (e as Error).message);
    return json({ ok: false, error: 'bad' }, 400);
  }
});
