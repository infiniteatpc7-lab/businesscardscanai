/**
 * API Service for Business Card Scanner, Contacts, and Authentication
 */

const TOKEN_KEY = 'bcs_auth_token';

export function getStoredToken() {
    return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token) {
    if (token) {
        localStorage.setItem(TOKEN_KEY, token);
    } else {
        localStorage.removeItem(TOKEN_KEY);
    }
}

export function clearStoredToken() {
    localStorage.removeItem(TOKEN_KEY);
}

/**
 * Ensures an active API token is present.
 * If absent, calls /api/auth/bootstrap to obtain a token for the default workspace session.
 */
export async function ensureAuthToken() {
    let token = getStoredToken();
    if (token) {
        return token;
    }

    try {
        const res = await fetch('/api/auth/bootstrap', {
            headers: {
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
            },
        });
        const data = await res.json();
        if (data.success && data.token) {
            setStoredToken(data.token);
            return data.token;
        }
    } catch (e) {
        console.error('Failed to bootstrap auth token:', e);
    }

    return null;
}

/**
 * Authenticated fetch helper with Bearer token injection and auto-retry on 401.
 */
async function authFetch(url, options = {}, isRetry = false) {
    let token = await ensureAuthToken();

    const headers = {
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        ...(options.headers || {}),
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
        ...options,
        headers,
    });

    // If 401 Unauthorized occurs, clear token and retry once with fresh bootstrap
    if (response.status === 401 && !isRetry) {
        clearStoredToken();
        const newToken = await ensureAuthToken();
        if (newToken) {
            headers['Authorization'] = `Bearer ${newToken}`;
            return fetch(url, { ...options, headers });
        }
    }

    return response;
}

/**
 * Fetch all cards for current workspace.
 */
export async function fetchCards(search = '') {
    const url = search ? `/api/cards?search=${encodeURIComponent(search)}` : '/api/cards';
    const response = await authFetch(url);
    return response.json();
}

/**
 * Scan an uploaded card image using Gemini Vision API.
 */
export async function scanCard({ file, base64Url }) {
    const formData = new FormData();
    if (file) {
        formData.append('image', file);
    } else if (base64Url) {
        formData.append('image_base64', base64Url);
    }

    const response = await authFetch('/api/scan', {
        method: 'POST',
        body: formData,
    });
    return response.json();
}

/**
 * Store a card with duplicate detection.
 */
export async function saveCard(cardData) {
    const response = await authFetch('/api/cards', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
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

/**
 * Delete a card (workspace owners & admins).
 */
export async function deleteCard(id) {
    const response = await authFetch(`/api/cards/${id}`, {
        method: 'DELETE',
    });
    return response.json();
}

/**
 * Get secure image URL for a card, attaching token if necessary.
 */
export function getCardImageUrl(card) {
    if (!card) return null;
    const token = getStoredToken();
    if (card.id) {
        return `/api/cards/${card.id}/image${token ? `?token=${token}` : ''}`;
    }
    return card.image_path || null;
}

/**
 * Auth APIs
 */
export async function loginUser(email, password) {
    const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        body: JSON.stringify({ email, password }),
    });

    const data = await response.json();
    if (data.success && data.token) {
        setStoredToken(data.token);
    }
    return data;
}

export async function registerUser(name, email, password, workspaceName = '') {
    const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        body: JSON.stringify({ name, email, password, workspace_name: workspaceName }),
    });

    const data = await response.json();
    if (data.success && data.token) {
        setStoredToken(data.token);
    }
    return data;
}

export async function fetchAuthUser() {
    const response = await authFetch('/api/auth/user');
    return response.json();
}

export async function logoutUser() {
    try {
        await authFetch('/api/auth/logout', { method: 'POST' });
    } finally {
        clearStoredToken();
    }
}
