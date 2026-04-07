// When `VITE_API_URL` is intentionally set to an empty string we want
// to use relative URLs (so the app can call `/api/...` and let nginx proxy).
// Default to empty string so the app uses relative paths by default.
const BASE_URL = import.meta.env.VITE_API_URL !== undefined
  ? import.meta.env.VITE_API_URL
  : '';
const TOKEN_KEY = 'democase_token';
const USER_KEY  = 'democase_user';

export const tokenHelpers = {
  // Save token after successful login
  save:  (token) => localStorage.setItem(TOKEN_KEY, token),

  // Get token for Authorization header
  get:   ()      => localStorage.getItem(TOKEN_KEY),

  // Clear token on logout
  clear: ()      => localStorage.removeItem(TOKEN_KEY),

  // Check if user is currently logged in
  exists: ()     => !!localStorage.getItem(TOKEN_KEY),
};

export const userHelpers = {
  save:  (user) => localStorage.setItem(USER_KEY, JSON.stringify(user)),
  get:   ()     => {
    const u = localStorage.getItem(USER_KEY);
    return u ? JSON.parse(u) : null;
  },
  clear: ()     => localStorage.removeItem(USER_KEY),
};

async function request(path, options = {}) {
  const token = tokenHelpers.get();

  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers, // allow override
  };

    const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  // Parse JSON response
  const data = await response.json();

  // If status is not 2xx (200-299), throw an error
  // This lets us use try/catch in components
  if (!response.ok) {
    const error = new Error(data.error?.message || 'Request failed');
    error.status  = response.status;
    error.code    = data.error?.code;
    throw error;
  }

  return data;
}

export const api = {

  // AUTH

  // POST /api/auth/login
  // Returns: { token, user }
  login: (email, password, role) =>
    request('/api/auth/login', {
      method: 'POST',
      body:   JSON.stringify({ email, password, role }),
    }),

  // POST /api/auth/register
  register: (userData) =>
    request('/api/auth/register', {
      method: 'POST',
      body:   JSON.stringify(userData),
    }),

  // USERS

  // GET /api/users/me
  // Returns the currently logged-in user's profile
  getMe: () => request('/api/users/me'),

  // GET /api/users/lawyers
  getLawyers: () => request('/api/users/lawyers'),

  // CASES
  // GET /api/cases?status=active&page=1&limit=20
  // params is an object like { status: 'active', page: 1 }
  getCases: (params = {}) => {
    // Convert params object to query string
    // { status: 'active', page: 1 } → '?status=active&page=1'
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== '' && v !== 'all')
    ).toString();
    return request(`/api/cases${qs ? `?${qs}` : ''}`);
  },
  // GET /api/cases/:id
  getCaseById: (id) => request(`/api/cases/${id}`),
  // GET /api/cases/stats (lawyer only)

  getCaseStats: () => request('/api/cases/stats'),

  // POST /api/cases (client only — file a complaint)
  createCase: (data) =>
    request('/api/cases', {
      method: 'POST',
      body:   JSON.stringify(data),
    }),

  // PATCH /api/cases/:id (lawyer only)
  updateCase: (id, updates) =>
    request(`/api/cases/${id}`, {
      method: 'PATCH',
      body:   JSON.stringify(updates),
    }),

  // MATTERS

  // GET /api/cases/:caseId/matters?status=open
  getMatters: (caseId, params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== '' && v !== 'all')
    ).toString();
    return request(`/api/cases/${caseId}/matters${qs ? `?${qs}` : ''}`);
  },

  // GET /api/matters/:matterId
  getMatterById: (matterId) => request(`/api/matters/${matterId}`),

  // POST /api/cases/:caseId/matters (lawyer only)
  createMatter: (caseId, data) =>
    request(`/api/cases/${caseId}/matters`, {
      method: 'POST',
      body:   JSON.stringify(data),
    }),

  // PATCH /api/matters/:matterId (update fields)
  updateMatter: (matterId, data) =>
    request(`/api/matters/${matterId}`, {
      method: 'PATCH',
      body:   JSON.stringify(data),
    }),

  // PATCH /api/matters/:matterId/transition (change status)
  transitionMatter: (matterId, status, reason) =>
    request(`/api/matters/${matterId}/transition`, {
      method: 'PATCH',
      body:   JSON.stringify({ status, reason }),
    }),

  // DELETE /api/matters/:matterId
  deleteMatter: (matterId) =>
    request(`/api/matters/${matterId}`, { method: 'DELETE' }),

  //  FILE UPLOAD 

  // POST /api/cases/:id/documents (multipart/form-data)
  // Special case — does NOT use request() because file upload
  // needs FormData, not JSON. We build the fetch manually.
  uploadDocument: async (caseId, file) => {
    const token    = tokenHelpers.get();
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${BASE_URL}/api/cases/${caseId}/documents`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}` },
      // NOTE: Do NOT set Content-Type header for FormData
      // The browser sets it automatically with the correct boundary
      body:    formData,
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Upload failed');
    return data;
  },
};
