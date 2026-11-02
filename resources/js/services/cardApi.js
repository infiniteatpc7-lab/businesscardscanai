/**
 * API Service for Business Card Scanner and Contacts
 */

export async function fetchCards(search = '') {
    const url = search ? `/api/cards?search=${encodeURIComponent(search)}` : '/api/cards';
    const response = await fetch(url, {
        headers: {
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
        },
    });
    return response.json();
}

export async function scanCard({ file, base64Url }) {
    const formData = new FormData();
    if (file) {
        formData.append('image', file);
    } else if (base64Url) {
        formData.append('image_base64', base64Url);
    }

    const response = await fetch('/api/scan', {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
        },
        body: formData,
    });
    return response.json();
}

export async function saveCard(cardData) {
    const response = await fetch('/api/cards', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify(cardData),
    });

    const data = await response.json().catch(() => ({}));

    return {
        ...data,
        status: response.status,
        ok: response.ok,
    };
}

export async function deleteCard(id) {
    const response = await fetch(`/api/cards/${id}`, {
        method: 'DELETE',
        headers: {
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
        },
    });
    return response.json();
}

