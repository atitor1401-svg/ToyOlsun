// Phone helpers for the Call / WhatsApp buttons on a service.
// Numbers are stored like "+994 55 204 03 02" or "+994 997992933".

const AZ_MOBILE_PREFIXES = ['10', '50', '51', '55', '60', '70', '77', '99'];

// Returns the number as 994XXXXXXXXX, or null when it is missing or an obvious
// placeholder (e.g. "+994 50 000 00 00", "+994 50 111 11 11").
export const normalizeAzPhone = (raw?: string | null): string | null => {
    let digits = (raw || '').replace(/\D/g, '');
    if (digits.startsWith('00')) digits = digits.slice(2);
    if (digits.length === 10 && digits.startsWith('0')) digits = '994' + digits.slice(1);
    if (digits.length === 9) digits = '994' + digits;
    if (!/^994\d{9}$/.test(digits)) return null;
    const subscriber = digits.slice(5); // last 7 digits
    if (/^(\d)\1{6}$/.test(subscriber)) return null;
    return digits;
};

export const isAzMobile = (normalized: string): boolean =>
    AZ_MOBILE_PREFIXES.includes(normalized.slice(3, 5));

export const telUrl = (normalized: string) => `tel:+${normalized}`;

export const whatsappUrl = (normalized: string, message: string) =>
    `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
