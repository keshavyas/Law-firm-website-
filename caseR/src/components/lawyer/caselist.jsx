// frontend/src/components/lawyer/CaseList.jsx
// ═══════════════════════════════════════════════════════════════
// FILE: src/components/lawyer/CaseList.jsx
// STATUS: CHANGED FILE
//
// WHY IT CHANGED:
//   Before: cases came from mockData.js, filtering was done in JS
//   After:  calls api.getCases() with filter params
//           The BACKEND does the filtering — not the frontend
//           This is more efficient with large datasets
//
// WHAT CHANGED:
//   Search and filters now send query params to the backend
//   e.g., api.getCases({ status: 'active', search: 'property' })
//   → GET /api/cases?status=active&search=property
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { api }                 from '../../services/api.js';

export default function CaseList({ onNavigate }) {
  const [cases,    setCases]    = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  // Filter state — these are sent as query params to the backend
  const [search,   setSearch]   = useState('');
  const [status,   setStatus]   = useState('all');
  const [category, setCategory] = useState('');

  // Pagination state
  const [page,       setPage]       = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total,      setTotal]      = useState(0);

  // Fetch cases whenever filters or page changes
  useEffect(() => {
    fetchCases();
  }, [status, category, page]); // re-fetch when these change

  // Fetch cases with current filter params
  async function fetchCases() {
    setLoading(true);
    setError('');
    try {
      // Build params object — api.getCases() converts to query string
      const params = { page, limit: 10 };
      if (status   && status   !== 'all') params.status   = status;
      if (category && category !== '')    params.category = category;
      if (search   && search   !== '')    params.search   = search;

      const response = await api.getCases(params);
      setCases(response.data.cases);
      setTotalPages(response.data.totalPages);
      setTotal(response.data.total);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Search handler — triggered by Enter key or button click
  function handleSearch(e) {
    e.preventDefault();
    setPage(1); // reset to first page on new search
    fetchCases();
  }

  return (
    <div className="p-6">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-serif font-medium text-stone-800">
          Cases ({total})
        </h1>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-wrap gap-3 mb-5">

        {/* Search input */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by title, ID, client..."
            className="px-3 py-2 border border-stone-200 rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-stone-400"
          />
          <button
            type="submit"
            className="px-3 py-2 bg-stone-800 text-white rounded-lg text-sm"
          >
            Search
          </button>
        </form>

        {/* Status filter */}
        <select
          value={status}
          onChange={e => { setStatus(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="active">Active</option>
          <option value="urgent">Urgent</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>

        {/* Category filter */}
        <select
          value={category}
          onChange={e => { setCategory(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none"
        >
          <option value="">All Categories</option>
          <option value="Civil">Civil</option>
          <option value="Criminal">Criminal</option>
          <option value="Family">Family</option>
          <option value="Consumer">Consumer</option>
          <option value="Labour">Labour</option>
          <option value="Corporate">Corporate</option>
          <option value="Other">Other</option>
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 mb-4">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="text-center py-12 text-stone-400 text-sm">
          Loading cases...
        </div>
      ) : cases.length === 0 ? (
        <div className="text-center py-12 text-stone-400 text-sm">
          No cases found
        </div>
      ) : (
        <>
          {/* Cases table */}
          <div className="space-y-2">
            {cases.map(c => (
              <div
                key={c.id}
                onClick={() => onNavigate('case-detail', c.id)}
                className="bg-white border border-stone-200 rounded-xl px-5 py-4 cursor-pointer hover:border-stone-400 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-stone-400">{c.id}</span>
                      <CategoryBadge category={c.category} />
                      <PriorityBadge priority={c.priority} />
                    </div>
                    <p className="text-sm font-medium text-stone-800">{c.title}</p>
                    <p className="text-xs text-stone-500 mt-1">
                      Client: {c.clientName} · Updated: {c.lastUpdated}
                    </p>
                  </div>
                  <StatusBadge status={c.status} />
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-6">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 border border-stone-200 rounded-lg text-sm disabled:opacity-40"
              >
                ← Prev
              </button>
              <span className="text-sm text-stone-500">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 border border-stone-200 rounded-lg text-sm disabled:opacity-40"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Badge components ─────────────────────────────────────────────

function StatusBadge({ status }) {
  const styles = {
    pending:  'bg-amber-100 text-amber-800',
    active:   'bg-blue-100  text-blue-800',
    urgent:   'bg-red-100   text-red-800',
    resolved: 'bg-green-100 text-green-800',
    closed:   'bg-stone-100 text-stone-600',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles[status] || styles.pending}`}>
      {status}
    </span>
  );
}

function CategoryBadge({ category }) {
  return (
    <span className="text-xs px-2 py-0.5 bg-stone-100 text-stone-600 rounded-full">
      {category}
    </span>
  );
}

function PriorityBadge({ priority }) {
  const styles = {
    low:    'text-stone-400',
    medium: 'text-amber-600',
    high:   'text-red-600',
  };
  return (
    <span className={`text-xs font-medium ${styles[priority] || ''}`}>
      {priority}
    </span>
  );
}
