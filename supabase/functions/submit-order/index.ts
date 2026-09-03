import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { fullName, phone, eventDate, guests, cart, totalEstimate, lang } = await req.json();

    const TELEGRAM_TOKEN = Deno.env.get('TELEGRAM_TOKEN');
    const TELEGRAM_CHAT_ID = Deno.env.get('TELEGRAM_CHAT_ID');

    const text = `🎊 YENİ SİFARİŞ (${(lang || 'az').toUpperCase()})!\n\n👤 Ad Soyad: ${fullName || 'Qeyd edilməyib'}\n📞 Telefon: ${phone || 'Qeyd edilməyib'}\n📅 Tarix: ${eventDate}\n👥 Qonaq: ${guests}\n💰 Məbləğ: ${totalEstimate} AZN\n\n🛒 Seçilənlər:\n${(cart || []).map((i: any) => `• ${i.title}`).join('\n')}`;

    const mainResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text })
    });

    if (!mainResponse.ok) {
      throw new Error('Failed to send main notification');
    }

    for (const item of (cart || [])) {
      if (item.telegram_chat_id) {
        const vendorText = `🎊 YENİ SİFARİŞ!\n\n👤 ${fullName || 'Qeyd edilməyib'}\n📞 ${phone || 'Qeyd edilməyib'}\n📅 ${eventDate}\n👥 ${guests} qonaq\n💰 ${item.category === 'venues' ? item.price * guests : item.price} AZN\n\n✅ Xidmət: ${item.title}`;
        await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: item.telegram_chat_id, text: vendorText })
        });
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});