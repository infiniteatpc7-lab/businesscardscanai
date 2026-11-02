/**
 * API Service for Business Card Scanner, Contacts, and Authentication
 * Strictly uses Authorization: Bearer <token> header.
 * No credentials in URLs or query strings.
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
 * Authenticated fetch helper with Bearer token injection.
 * Credentials are sent EXCLUSIVELY via Authorization header.
 */
export async function authFetch(url, options = {}) {
    const token = getStoredToken();

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

    if (response.status === 401) {
        clearStoredToken();
        window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    }

    return response;
}

/**
 * Fetch all cards for current workspace.
 */
export async function fetchCards(search = '') {
    const url = search ? `/api/cards?search=${encodeURIComponent(search)}` : '/api/cards';
    const response = await authFetch(url);
    if (response.status === 401) {
        return { success: false, unauthenticated: true, cards: [] };
    }
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
 * Update an existing card (PUT /api/cards/{id}).
 */
export async function updateCard(id, cardData) {
    const response = await authFetch(`/api/cards/${id}`, {
        method: 'PUT',
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
 * Workspace APIs
 */
export async function fetchWorkspaces() {
    const response = await authFetch('/api/workspaces');
    return response.json();
}

export async function createWorkspace(name) {
    const response = await authFetch('/api/workspaces', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name }),
    });
    return response.json();
}

export async function switchWorkspace(workspaceId) {
    const response = await authFetch('/api/auth/switch-workspace', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ workspace_id: workspaceId }),
    });
    return response.json();
}

export async function fetchWorkspaceMembers(workspaceId) {
    const response = await authFetch(`/api/workspaces/${workspaceId}/members`);
    return response.json();
}

export async function inviteWorkspaceMember(workspaceId, email, role) {
    const response = await authFetch(`/api/workspaces/${workspaceId}/invitations`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, role }),
    });
    return response.json();
}

export async function resendInvitation(workspaceId, invitationId) {
    const response = await authFetch(`/api/workspaces/${workspaceId}/invitations/${invitationId}/resend`, {
        method: 'POST',
    });
    return response.json();
}

export async function revokeInvitation(workspaceId, invitationId) {
    const response = await authFetch(`/api/workspaces/${workspaceId}/invitations/${invitationId}`, {
        method: 'DELETE',
    });
    return response.json();
}

export async function updateMemberRole(workspaceId, userId, role) {
    const response = await authFetch(`/api/workspaces/${workspaceId}/members/${userId}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role }),
    });
    return response.json();
}

export async function removeMember(workspaceId, userId) {
    const response = await authFetch(`/api/workspaces/${workspaceId}/members/${userId}`, {
        method: 'DELETE',
    });
    return response.json();
}

export async function acceptInvitation(token) {
    const response = await authFetch(`/api/invitations/${encodeURIComponent(token)}/accept`, {
        method: 'POST',
    });
    return response.json();
}

/**
 * Securely fetch private card image via Bearer-authenticated blob request.
 * Credentials never touch the URL.
 */
export async function fetchCardImageBlob(cardId) {
    if (!cardId) return null;
    try {
        const response = await authFetch(`/api/cards/${cardId}/image`);
        if (!response.ok) return null;
        const blob = await response.blob();
        return URL.createObjectURL(blob);
    } catch {
        return null;
    }
}

/**
 * Resolve direct image string for public samples or client preview data URLs.
 */
export function getCardImageUrl(card) {
    if (!card) return null;
    if (card.image_path && (card.image_path.startsWith('data:') || card.image_path.startsWith('/samples/'))) {
        return card.image_path;
    }
    return null;
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
    if (!response.ok) {
        return { success: false };
    }
    return response.json();
}

export async function logoutUser() {
    try {
        await authFetch('/api/auth/logout', { method: 'POST' });
    } finally {
        clearStoredToken();
    }
}
