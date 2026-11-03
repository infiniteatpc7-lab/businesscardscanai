/**
 * BusinessCardScanAI — Platform Admin API Client
 * Completely isolated from customer authentication and state.
 */

const ADMIN_TOKEN_KEY = 'bcs_platform_admin_token';
const ADMIN_PROFILE_KEY = 'bcs_platform_admin_profile';

export function getAdminToken() {
    return localStorage.getItem(ADMIN_TOKEN_KEY);
}

export function setAdminSession(token, adminProfile) {
    localStorage.setItem(ADMIN_TOKEN_KEY, token);
    if (adminProfile) {
        localStorage.setItem(ADMIN_PROFILE_KEY, JSON.stringify(adminProfile));
    }
}

export function clearAdminSession() {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    localStorage.removeItem(ADMIN_PROFILE_KEY);
}

export function getAdminProfile() {
    try {
        const raw = localStorage.getItem(ADMIN_PROFILE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

async function adminFetch(endpoint, options = {}) {
    const token = getAdminToken();
    const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...(options.headers || {}),
    };

    const res = await fetch(endpoint, {
        ...options,
        headers,
    });

    if (res.status === 401) {
        clearAdminSession();
        return { unauthenticated: true, success: false, message: 'Administrator session expired.' };
    }

    const data = await res.json().catch(() => ({}));
    return { ...data, status: res.status, ok: res.ok };
}

export async function loginAdmin(email, password) {
    const res = await fetch('/api/platform-admin/auth/login', {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success && data.token) {
        setAdminSession(data.token, data.admin);
    }
    return { ...data, status: res.status, ok: res.ok };
}

export async function fetchAdminMe() {
    return adminFetch('/api/platform-admin/auth/me');
}

export async function logoutAdmin() {
    try {
        await adminFetch('/api/platform-admin/auth/logout', { method: 'POST' });
    } finally {
        clearAdminSession();
    }
}

export async function fetchDashboardStats() {
    return adminFetch('/api/platform-admin/dashboard/stats');
}

export async function fetchCustomers({ page = 1, perPage = 15, search = '', status = 'all' } = {}) {
    const params = new URLSearchParams();
    if (page) params.append('page', page);
    if (perPage) params.append('per_page', perPage);
    if (search) params.append('search', search);
    if (status && status !== 'all') params.append('status', status);

    return adminFetch(`/api/platform-admin/customers?${params.toString()}`);
}

export async function fetchCustomerDetails(id) {
    return adminFetch(`/api/platform-admin/customers/${id}`);
}

export async function suspendCustomer(id, reason) {
    return adminFetch(`/api/platform-admin/customers/${id}/suspend`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
    });
}

export async function activateCustomer(id) {
    return adminFetch(`/api/platform-admin/customers/${id}/activate`, {
        method: 'POST',
    });
}

export async function fetchAdminWorkspaces({ page = 1, perPage = 15, search = '', status = 'all' } = {}) {
    const params = new URLSearchParams();
    if (page) params.append('page', page);
    if (perPage) params.append('per_page', perPage);
    if (search) params.append('search', search);
    if (status && status !== 'all') params.append('status', status);

    return adminFetch(`/api/platform-admin/workspaces?${params.toString()}`);
}

export async function fetchAdminWorkspaceDetails(id) {
    return adminFetch(`/api/platform-admin/workspaces/${id}`);
}

export async function suspendWorkspace(id, reason) {
    return adminFetch(`/api/platform-admin/workspaces/${id}/suspend`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
    });
}

export async function activateWorkspace(id) {
    return adminFetch(`/api/platform-admin/workspaces/${id}/activate`, {
        method: 'POST',
    });
}

export async function fetchAdminAuditLogs({ page = 1, perPage = 25, search = '', action = '' } = {}) {
    const params = new URLSearchParams();
    if (page) params.append('page', page);
    if (perPage) params.append('per_page', perPage);
    if (search) params.append('search', search);
    if (action) params.append('action', action);

    return adminFetch(`/api/platform-admin/audit-logs?${params.toString()}`);
}

export async function fetchAdminPlans() {
    return adminFetch('/api/platform-admin/plans');
}

export async function createAdminPlan(payload) {
    return adminFetch('/api/platform-admin/plans', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

export async function updateAdminPlan(id, payload) {
    return adminFetch(`/api/platform-admin/plans/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
    });
}

export async function toggleAdminPlanStatus(id) {
    return adminFetch(`/api/platform-admin/plans/${id}/toggle-status`, {
        method: 'POST',
    });
}

export async function fetchWorkspaceSubscription(workspaceId) {
    return adminFetch(`/api/platform-admin/workspaces/${workspaceId}/subscription`);
}

export async function changeWorkspacePlan(workspaceId, planId, reason = '') {
    return adminFetch(`/api/platform-admin/workspaces/${workspaceId}/change-plan`, {
        method: 'POST',
        body: JSON.stringify({ plan_id: planId, reason }),
    });
}


