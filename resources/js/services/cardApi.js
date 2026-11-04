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

    if (response.status === 403) {
        try {
            response.clone().json().then((data) => {
                if (data?.error_code === 'FEATURE_NOT_INCLUDED' || data?.error_code === 'QUOTA_EXCEEDED') {
                    window.dispatchEvent(new CustomEvent('plan:upgrade_required', { detail: data }));
                }
            }).catch(() => {});
        } catch {
            // Ignore cloning errors on non-json stream
        }
    }

    return response;
}

/**
 * Fetch all cards for current workspace.
 * Supports search, exhibition filtering, member filtering, and date range.
 */
export async function fetchCards(search = '', exhibitionId = '', memberId = '', fromDate = '', toDate = '') {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (exhibitionId && exhibitionId !== 'all') params.append('exhibition_id', exhibitionId);
    if (memberId && memberId !== 'all') params.append('member_id', memberId);
    if (fromDate) params.append('from_date', fromDate);
    if (toDate) params.append('to_date', toDate);

    const queryString = params.toString();
    const url = queryString ? `/api/cards?${queryString}` : '/api/cards';
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
 * Release a reserved scan credit upon extraction failure, cancellation or abandoned review.
 */
export async function releaseScanReservation(scanIdempotencyKey, reason = 'user_abandoned_review') {
    if (!scanIdempotencyKey) return { success: false };
    try {
        const response = await authFetch('/api/scan/release', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                scan_idempotency_key: scanIdempotencyKey,
                reason,
            }),
        });
        return await response.json();
    } catch {
        return { success: false };
    }
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
 * Securely fetch private card image (front or back) via Bearer-authenticated blob request.
 * Credentials never touch the URL.
 */
export async function fetchCardImageBlob(cardId, type = 'front') {
    if (!cardId) return null;
    try {
        const query = type === 'back' ? '?type=back' : '';
        const response = await authFetch(`/api/cards/${cardId}/image${query}`);
        if (!response.ok) return null;
        const blob = await response.blob();
        return URL.createObjectURL(blob);
    } catch {
        return null;
    }
}

/**
 * Upload a standalone card image (e.g. back of card or replacement image).
 */
export async function uploadCardImage({ file, base64Url }) {
    const formData = new FormData();
    if (file) {
        formData.append('image', file);
    } else if (base64Url) {
        formData.append('image_base64', base64Url);
    }

    const response = await authFetch('/api/cards/upload-image', {
        method: 'POST',
        body: formData,
    });
    return response.json();
}

/**
 * Exhibition APIs
 */
export async function fetchExhibitions(status = '') {
    const url = status ? `/api/exhibitions?status=${encodeURIComponent(status)}` : '/api/exhibitions';
    const response = await authFetch(url);
    return response.json();
}

export async function fetchCurrentExhibition() {
    const response = await authFetch('/api/exhibitions/current');
    return response.json();
}

export async function selectCurrentExhibition(exhibitionId) {
    const response = await authFetch('/api/exhibitions/current', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ exhibition_id: exhibitionId }),
    });
    return response.json();
}

export async function createExhibition(data) {
    const response = await authFetch('/api/exhibitions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });
    return response.json();
}

export async function updateExhibition(id, data) {
    const response = await authFetch(`/api/exhibitions/${id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });
    return response.json();
}

export async function deleteExhibition(id) {
    const response = await authFetch(`/api/exhibitions/${id}`, {
        method: 'DELETE',
    });
    return response.json();
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

/**
 * Bulk Multiple Photo Import API
 */
export async function createBulkImport({ exhibitionId, expectedCount = 10, clientBatchUuid = null }) {
    const response = await authFetch('/api/bulk-imports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            exhibition_id: exhibitionId,
            expected_count: expectedCount,
            client_batch_uuid: clientBatchUuid,
        }),
    });
    return response.json();
}

export async function fetchBulkImports() {
    const response = await authFetch('/api/bulk-imports');
    return response.json();
}

export async function fetchBulkImport(uuid) {
    const response = await authFetch(`/api/bulk-imports/${uuid}`);
    return response.json();
}

export async function uploadBulkItem(uuid, { clientItemId, sequenceOrder = 0, file, base64Url }) {
    const formData = new FormData();
    formData.append('client_item_id', clientItemId);
    formData.append('sequence_order', String(sequenceOrder));
    if (file) {
        formData.append('image', file);
    } else if (base64Url) {
        formData.append('image_base64', base64Url);
    }

    const response = await authFetch(`/api/bulk-imports/${uuid}/items`, {
        method: 'POST',
        body: formData,
    });
    return response.json();
}

export async function uploadBulkItemBackImage(uuid, itemId, { file, base64Url }) {
    const formData = new FormData();
    if (file) {
        formData.append('back_image', file);
    } else if (base64Url) {
        formData.append('back_image_base64', base64Url);
    }

    const response = await authFetch(`/api/bulk-imports/${uuid}/items/${itemId}/back-image`, {
        method: 'POST',
        body: formData,
    });
    return response.json();
}

export async function processBulkImport(uuid) {
    const response = await authFetch(`/api/bulk-imports/${uuid}/process`, {
        method: 'POST',
    });
    return response.json();
}

export async function processBulkImportNext(uuid) {
    const response = await authFetch(`/api/bulk-imports/${uuid}/process-next`, {
        method: 'POST',
    });
    return response.json();
}

export async function fetchBulkProgress(uuid) {
    const response = await authFetch(`/api/bulk-imports/${uuid}/progress`);
    return response.json();
}

export async function fetchBulkItems(uuid, filter = 'all') {
    const response = await authFetch(`/api/bulk-imports/${uuid}/items?filter=${filter}`);
    return response.json();
}

export async function fetchBulkItemImageBlob(uuid, itemId, type = 'front') {
    if (!uuid || !itemId) return null;
    try {
        const query = type === 'back' ? '?type=back' : '';
        const response = await authFetch(`/api/bulk-imports/${uuid}/items/${itemId}/image${query}`);
        if (!response.ok) return null;
        const blob = await response.blob();
        return URL.createObjectURL(blob);
    } catch {
        return null;
    }
}

export async function updateBulkItem(uuid, itemId, payload) {
    const response = await authFetch(`/api/bulk-imports/${uuid}/items/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    return response.json();
}

export async function retryBulkItem(uuid, itemId) {
    const response = await authFetch(`/api/bulk-imports/${uuid}/items/${itemId}/retry`, {
        method: 'POST',
    });
    return response.json();
}

export async function commitBulkImport(uuid, items = []) {
    const response = await authFetch(`/api/bulk-imports/${uuid}/commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
    });
    return response.json();
}

export async function cancelBulkImport(uuid) {
    const response = await authFetch(`/api/bulk-imports/${uuid}/cancel`, {
        method: 'POST',
    });
    return response.json();
}

/**
 * Export cards via authenticated backend endpoint enforcing plan entitlements.
 */
export async function exportCards(format = 'csv') {
    const response = await authFetch(`/api/cards/export?format=${format}`);
    if (response.status === 403) {
        const data = await response.json().catch(() => ({}));
        return {
            success: false,
            forbidden: true,
            error_code: data.error_code,
            message: data.message || 'CSV/Excel export is not included in your current plan.'
        };
    }
    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        return { success: false, message: data.message || 'Failed to download export file.' };
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `contacts_export_${new Date().toISOString().slice(0, 10)}.${format === 'excel' ? 'xlsx' : 'csv'}`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    return { success: true };
}

/**
 * Customer Subscription, Quota & Billing APIs
 */

export async function fetchCustomerSubscription() {
    const response = await authFetch('/api/subscription/current');
    return response.json();
}

export async function fetchCustomerUsageLedger(page = 1, perPage = 15) {
    const response = await authFetch(`/api/subscription/usage-ledger?page=${page}&per_page=${perPage}`);
    return response.json();
}

export async function fetchCustomerSubscriptionHistory() {
    const response = await authFetch('/api/subscription/history');
    return response.json();
}

export async function fetchCustomerPaymentHistory({ status = 'all', page = 1, perPage = 10 } = {}) {
    const params = new URLSearchParams();
    if (status && status !== 'all') params.append('status', status);
    if (page) params.append('page', page);
    if (perPage) params.append('per_page', perPage);

    const response = await authFetch(`/api/subscription/payments?${params.toString()}`);
    return response.json();
}

export async function fetchAvailablePlans() {
    const response = await authFetch('/api/subscription/plans');
    return response.json();
}

export async function requestPlanUpgrade({ planId, note = '', phone = '' }) {
    const response = await authFetch('/api/subscription/request-upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_id: planId, note, phone }),
    });
    return response.json();
}
