/**
 * Utility to generate and download RFC 6350 vCard (.vcf) directly in browser
 */
export function downloadVCard(card) {
    if (!card) return;

    const name = card.name || card.name_english || card.company || 'Business Contact';
    const company = card.company || card.company_english || '';
    const title = card.designation || '';
    const email = card.email || '';
    const website = card.website || '';
    const address = card.address || card.address_english || '';
    const phoneList = Array.isArray(card.phone) ? card.phone : (card.phone ? [card.phone] : []);

    let vcf = `BEGIN:VCARD
VERSION:3.0
FN:${name}
`;

    if (company) {
        vcf += `ORG:${company}\n`;
    }
    if (title) {
        vcf += `TITLE:${title}\n`;
    }
    phoneList.forEach((phone, idx) => {
        const cleanPhone = phone.replace(/[^0-9+]/g, '');
        vcf += `TEL;TYPE=${idx === 0 ? 'CELL,PREF' : 'WORK'}:${cleanPhone}\n`;
    });
    if (email) {
        vcf += `EMAIL;TYPE=WORK:${email}\n`;
    }
    if (website) {
        vcf += `URL:${website}\n`;
    }
    if (address) {
        vcf += `ADR;TYPE=WORK:;;${address};;;;\n`;
    }
    if (card.accuracy_score) {
        vcf += `NOTE:Scanned via CardScan AI. OCR Confidence: ${card.accuracy_score}%\n`;
    }

    vcf += 'END:VCARD';

    const blob = new Blob([vcf], { type: 'text/vcard;charset=utf-8;' });
    const filename = `${name.replace(/[^a-zA-Z0-9_\u0A80-\u0AFF]/g, '_')}.vcf`;

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * Open WhatsApp with pre-filled professional exhibition greeting
 */
export function openWhatsApp(phone, card, expoName = 'Ceramix Expo 2026') {
    if (!phone) return;
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const recipient = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const name = card?.name || card?.name_english || '';
    const company = card?.company || card?.company_english || '';

    const greeting = name ? `Hello ${name},` : 'Hello,';
    const message = `${greeting} Great meeting you at ${expoName}${company ? ` from ${company}` : ''}! Saving your contact details. Let's stay in touch.`;

    const url = `https://wa.me/${recipient}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
}

