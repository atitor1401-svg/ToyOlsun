// Turns the estimate (smeta) into a branded PDF and opens the share sheet,
// so the customer can send it to family on WhatsApp etc.
// It receives the lines already formatted by the estimate screen, so the PDF
// always shows exactly the same numbers as the app.
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { Language } from '@/app/(tabs)/index';

export interface EstimatePdfLine {
    category: string;
    title: string;
    detail: string;   // e.g. "45 AZN × 200 qonaq" or the unit
    price: string;    // final, formatted, e.g. "9 000 AZN"
    promo?: string;   // e.g. "TOY10 −10%"
}

export interface EstimatePdfData {
    lang: Language;
    eventTitle: string;
    date: string;
    guests: number;
    lines: EstimatePdfLine[];
    total: string;
    perGuest?: string | null;
    savings?: string | null;
}

const TEXT = {
    az: { title: 'Toy smetası', date: 'Tarix', guests: 'Qonaq sayı', service: 'Xidmət', price: 'Məbləğ', total: 'Ümumi məbləğ', perGuest: 'Bir qonağa', saved: 'Endirim', note: 'Qiymətlər təxminidir və partnyorla dəqiqləşdirilir.', footer: 'Toy Olsun tətbiqində hazırlanıb', file: 'Toy-smetasi' },
    ru: { title: 'Свадебная смета', date: 'Дата', guests: 'Гостей', service: 'Услуга', price: 'Сумма', total: 'Итого', perGuest: 'На гостя', saved: 'Скидка', note: 'Цены ориентировочные и уточняются у партнёра.', footer: 'Составлено в приложении Toy Olsun', file: 'Smeta' },
    en: { title: 'Wedding estimate', date: 'Date', guests: 'Guests', service: 'Service', price: 'Amount', total: 'Total', perGuest: 'Per guest', saved: 'Discount', note: 'Prices are estimates and are confirmed with each partner.', footer: 'Made with the Toy Olsun app', file: 'Estimate' },
};

const esc = (s: string) =>
    String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function buildHtml(d: EstimatePdfData): string {
    const t = TEXT[d.lang];
    const rows = d.lines.map(l => `
        <tr>
          <td>
            <div class="cat">${esc(l.category)}</div>
            <div class="name">${esc(l.title)}</div>
            <div class="detail">${esc(l.detail)}${l.promo ? ` · <span class="promo">${esc(l.promo)}</span>` : ''}</div>
          </td>
          <td class="price">${esc(l.price)}</td>
        </tr>`).join('');

    return `<!doctype html>
<html lang="${d.lang}"><head><meta charset="utf-8">
<style>
  @page { margin: 28px; }
  body { font-family: -apple-system, 'Helvetica Neue', Roboto, Arial, sans-serif; color: #1F1A17; }
  .head { border-bottom: 2px solid #D4AF37; padding-bottom: 14px; margin-bottom: 18px; }
  .brand { font-family: Georgia, serif; font-size: 13px; letter-spacing: 3px; color: #B8932F; text-transform: uppercase; }
  h1 { font-family: Georgia, serif; font-weight: 600; font-size: 28px; margin: 6px 0 4px; }
  .event { font-size: 15px; color: #6A625C; }
  .meta { display: flex; gap: 28px; margin: 12px 0 0; font-size: 13px; color: #6A625C; }
  .meta b { color: #1F1A17; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 11px; letter-spacing: 1px; text-transform: uppercase; color: #8A7E75; padding: 6px 0; border-bottom: 1px solid #E8E0D6; }
  th:last-child, td.price { text-align: right; }
  td { padding: 12px 0; border-bottom: 1px solid #F0EAE2; vertical-align: top; }
  .cat { font-size: 10.5px; letter-spacing: 1px; text-transform: uppercase; color: #B8932F; }
  .name { font-size: 15px; font-weight: 600; margin-top: 2px; }
  .detail { font-size: 12.5px; color: #7A6F66; margin-top: 2px; }
  .promo { color: #2E7D4F; font-weight: 600; }
  td.price { font-size: 15px; font-weight: 600; white-space: nowrap; padding-left: 16px; }
  .total { margin-top: 20px; background: #1F1A17; color: #fff; border-radius: 14px; padding: 18px 20px; }
  .total .label { font-size: 12px; letter-spacing: 1px; text-transform: uppercase; color: #D4AF37; }
  .total .amount { font-family: Georgia, serif; font-size: 30px; margin-top: 4px; }
  .total .sub { font-size: 13px; color: #CFC5BB; margin-top: 6px; }
  .note { font-size: 11.5px; color: #8A7E75; margin-top: 14px; }
  .foot { margin-top: 26px; font-size: 11px; color: #A0968E; text-align: center; }
</style></head>
<body>
  <div class="head">
    <div class="brand">Toy Olsun</div>
    <h1>${esc(t.title)}</h1>
    <div class="event">${esc(d.eventTitle)}</div>
    <div class="meta">
      <div>${esc(t.date)}: <b>${esc(d.date)}</b></div>
      ${d.guests > 0 ? `<div>${esc(t.guests)}: <b>${d.guests}</b></div>` : ''}
    </div>
  </div>
  <table>
    <thead><tr><th>${esc(t.service)}</th><th>${esc(t.price)}</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="total">
    <div class="label">${esc(t.total)}</div>
    <div class="amount">${esc(d.total)}</div>
    ${d.perGuest ? `<div class="sub">${esc(t.perGuest)} ≈ ${esc(d.perGuest)}</div>` : ''}
    ${d.savings ? `<div class="sub">${esc(t.saved)}: −${esc(d.savings)}</div>` : ''}
  </div>
  <div class="note">${esc(t.note)}</div>
  <div class="foot">${esc(t.footer)} · toyolsun</div>
</body></html>`;
}

// Returns false if sharing isn't possible on this device.
export async function shareEstimatePdf(data: EstimatePdfData): Promise<boolean> {
    const { uri } = await Print.printToFileAsync({ html: buildHtml(data), base64: false });
    if (!(await Sharing.isAvailableAsync())) return false;
    await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        UTI: 'com.adobe.pdf',
        dialogTitle: TEXT[data.lang].title,
    });
    return true;
}
