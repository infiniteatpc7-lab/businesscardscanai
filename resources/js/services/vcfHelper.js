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
 * Check if a phone number is likely a landline/office number (rather than a mobile with WhatsApp)
 */
export function isLandlineNumber(phone) {
    if (!phone) return false;
    const digits = phone.replace(/[^0-9]/g, '');

    // In India:
    // Mobile numbers:
    // 10 digits starting with 6, 7, 8, 9
    // 11 digits starting with 0 followed by 6, 7, 8, 9
    // 12 digits starting with 91 followed by 6, 7, 8, 9
    if (digits.length === 10) {
        return !['6', '7', '8', '9'].includes(digits[0]);
    }
    if (digits.length === 11 && digits.startsWith('0')) {
        return !['6', '7', '8', '9'].includes(digits[1]);
    }
    if (digits.length === 12 && digits.startsWith('91')) {
        return !['6', '7', '8', '9'].includes(digits[2]);
    }
    // Any short number (less than 10 digits, e.g. 6-8 digit local landline)
    if (digits.length > 0 && digits.length < 10) {
        return true;
    }
    return false;
}

/**
 * Direct phone dialer trigger
 */
export function initiatePhoneCall(phone) {
    if (!phone) return;
    const clean = phone.replace(/[^0-9+]/g, '');
    window.location.href = `tel:${clean}`;
}

/**
 * Open WhatsApp with direct app intent on mobile (no browser tab/popup prompt),
 * falling back gracefully if app not installed or running on desktop.
 */
export function openWhatsApp(phone, card, expoName = 'Ceramix Expo 2026') {
    if (!phone) return;
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const recipient = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const name = card?.name || card?.name_english || '';
    const company = card?.company || card?.company_english || '';

    const greeting = name ? `Hello ${name},` : 'Hello,';
    const message = `${greeting} Great meeting you at ${expoName}${company ? ` from ${company}` : ''}! Saving your contact details. Let's stay in touch.`;
    const encodedMessage = encodeURIComponent(message);

    const isMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    if (isMobile) {
        // Direct WhatsApp Application Deep Link (prevents popup blocks in Chrome/Safari)
        const appUrl = `whatsapp://send?phone=${recipient}&text=${encodedMessage}`;
        const webFallback = `https://wa.me/${recipient}?text=${encodedMessage}`;

        window.location.href = appUrl;

        // Fallback timer: if WhatsApp app isn't installed and window doesn't blur
        const start = Date.now();
        const fallbackTimer = setTimeout(() => {
            if (Date.now() - start < 2000 && typeof document !== 'undefined' && !document.hidden) {
                window.location.href = webFallback;
            }
        }, 1200);

        const onAppOpen = () => {
            clearTimeout(fallbackTimer);
            window.removeEventListener('pagehide', onAppOpen);
            window.removeEventListener('blur', onAppOpen);
        };

        window.addEventListener('pagehide', onAppOpen, { once: true });
        window.addEventListener('blur', onAppOpen, { once: true });
    } else {
        // Desktop browser -> WhatsApp Web
        window.open(`https://web.whatsapp.com/send?phone=${recipient}&text=${encodedMessage}`, '_blank');
    }
}
