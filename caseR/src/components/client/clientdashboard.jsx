import { useEffect } from 'react';
import { useApp }    from '../context/appcontext.jsx';

export default function ClientDashboard({ onNavigate }) {
  const { user, cases, loading, error, loadCases } = useApp();

  // Fetch client's cases when dashboard mounts
  // Backend RBAC ensures only this client's cases are returned
  useEffect(() => {
    loadCases();  // GET /api/cases — backend filters by clientId automatically
  }, []);

  // Case counts by status
  const activeCases   = cases.filter(c => c.status === 'active').length;
  const pendingCases  = cases.filter(c => c.status === 'pending').length;
  const resolvedCases = cases.filter(c => c.status === 'resolved' || c.status === 'closed').length;

  return (
    <div className="p-6 space-y-6">

      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-serif font-medium text-stone-800">
          Welcome, {user?.name}
        </h1>
        <p className="text-stone-500 text-sm mt-1">
          Track your cases and legal matters
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-stone-50 rounded-xl p-4">
          <p className="text-2xl font-medium text-stone-800">{cases.length}</p>
          <p className="text-xs text-stone-500 mt-1">Total Cases</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-4">
          <p className="text-2xl font-medium text-blue-800">{activeCases}</p>
          <p className="text-xs text-blue-600 mt-1">Active</p>
        </div>
        <div className="bg-amber-50 rounded-xl p-4">
          <p className="text-2xl font-medium text-amber-800">{pendingCases}</p>
          <p className="text-xs text-amber-600 mt-1">Pending</p>
        </div>
      </div>

      {/* File new complaint CTA */}
      <div
        onClick={() => onNavigate('file-complaint')}
        className="bg-stone-800 text-white rounded-xl p-5 cursor-pointer hover:bg-stone-700 transition-colors"
      >
        <p className="font-medium mb-1">Need legal help?</p>
        <p className="text-sm text-stone-300">
          File a new complaint and our lawyers will review it →
        </p>
      </div>

      {/* Recent cases */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-stone-900">My Cases</h2>
          <button
            onClick={() => onNavigate('cases')}
            className="text-xs text-stone-500 hover:text-stone-700"
          >
            View all →
          </button>
        </div>

        {loading ? (
          <div className="text-center py-8 text-stone-400 text-sm">Loading...</div>
        ) : cases.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-stone-400 text-sm mb-3">No cases yet</p>
            <button
              onClick={() => onNavigate('file-complaint')}
              className="px-4 py-2 bg-stone-800 text-white rounded-lg text-sm"
            >
              File your first complaint
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {cases.map(c => (
              <div
                key={c.id}
                onClick={() => onNavigate('case-detail', c.id)}
                className="bg-white border border-stone-200 rounded-xl px-4 py-3 cursor-pointer hover:border-stone-400 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-stone-800">{c.title}</p>
                    <p className="text-xs text-stone-400 mt-0.5 font-mono">{c.id}</p>
                    {c.lawyerNote && (
                      <p className="text-xs text-stone-500 mt-1 line-clamp-1">
                        Note: {c.lawyerNote}
                      </p>
                    )}
                  </div>
                  <StatusBadge status={c.status} />
                </div>
                {c.nextHearing && (
                  <p className="text-xs text-amber-600 mt-2">
                    Next hearing: {c.nextHearing}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
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
