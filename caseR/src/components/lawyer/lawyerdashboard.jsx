import { useEffect } from 'react';
import { useApp }    from '../context/appcontext.jsx';

export default function LawyerDashboard({ onNavigate }) {
  const { user, cases, stats, loading, error, loadCases, loadStats } = useApp();

  // useEffect runs when the component first mounts (appears on screen)
  // We fetch real data from the backend here
  useEffect(() => {
    loadStats();              // GET /api/cases/stats
    loadCases({ limit: 5 }); // GET /api/cases?limit=5
  }, []); // empty [] = run once on mount

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-stone-500 text-sm">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">

      {/* Welcome header */}
      <div>
        <h1 className="text-2xl font-serif font-medium text-stone-800">
          Welcome, {user?.name}
        </h1>
        <p className="text-stone-500 text-sm mt-1">
          {user?.firm} · {user?.specialization}
        </p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Stats cards — real data from GET /api/cases/stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Cases"  value={stats.total}              color="stone"  />
          <StatCard label="Active"       value={stats.byStatus?.active   || 0} color="blue"   />
          <StatCard label="Pending"      value={stats.byStatus?.pending  || 0} color="amber"  />
          <StatCard label="Urgent"       value={stats.byStatus?.urgent   || 0} color="red"    />
        </div>
      )}

      {/* Recent cases — real data from GET /api/cases */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-stone-900">Recent Cases</h2>
          <button
            onClick={() => onNavigate('cases')}
            className="text-xs text-stone-500 hover:text-stone-700"
          >
            View all →
          </button>
        </div>

        {cases.length === 0 ? (
          <div className="text-center py-8 text-stone-400 text-sm">
            No cases found
          </div>
        ) : (
          <div className="space-y-2">
            {cases.slice(0, 5).map(c => (
              <div
                key={c.id}
                onClick={() => onNavigate('case-detail', c.id)}
                className="bg-white border border-stone-200 rounded-lg px-4 py-3 cursor-pointer hover:border-stone-400 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-stone-800">{c.title}</p>
                    <p className="text-xs text-stone-500 mt-0.5">
                      {c.id} · {c.clientName} · {c.category}
                    </p>
                  </div>
                  <StatusBadge status={c.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upcoming hearings — from stats.upcoming */}
      {stats?.upcoming?.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-stone-900 mb-3">
            Upcoming Hearings
          </h2>
          <div className="space-y-2">
            {stats.upcoming.map(c => (
              <div
                key={c.id}
                className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-amber-900">{c.title}</p>
                  <p className="text-xs text-amber-700 font-medium">{c.nextHearing}</p>
                </div>
                <p className="text-xs text-amber-600 mt-0.5">{c.clientName}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

//  Small helper components

function StatCard({ label, value, color }) {
  const colors = {
    stone: 'bg-stone-50  text-stone-800',
    blue:  'bg-blue-50   text-blue-800',
    amber: 'bg-amber-50  text-amber-800',
    red:   'bg-red-50    text-red-800',
  };
  return (
    <div className={`rounded-xl p-4 ${colors[color]}`}>
      <p className="text-2xl font-medium">{value}</p>
      <p className="text-xs mt-1 opacity-70">{label}</p>
    </div>
  );
}

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
