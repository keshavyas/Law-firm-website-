import { useState, useEffect } from 'react';
import { api }      from '../../services/api.js';

export default function SummaryPage({ caseId, onBack }) {
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    async function fetchSummary() {
      try {
        setLoading(true);
        const res = await api.summarize(caseId);
        setSummary(res.data.summary);
      } catch (err) {
        setError(err.message || 'Failed to generate summary');
      } finally {
        setLoading(false);
      }
    }
    if (caseId) fetchSummary();
  }, [caseId]);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-serif font-medium text-stone-800">AI Case Summary</h1>
        <button 
          onClick={onBack}
          className="px-4 py-2 border border-stone-200 rounded-lg text-sm text-stone-600 hover:bg-stone-50"
        >
          ← Return to Case
        </button>
      </div>

      <div className="bg-white border border-stone-200 rounded-2xl p-8 shadow-sm">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <div className="w-8 h-8 border-4 border-stone-200 border-t-stone-800 rounded-full animate-spin" />
            <p className="text-sm text-stone-500 font-medium">Analyzing documents and generating summary...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
            <p className="text-red-600 text-sm font-medium">❌ {error}</p>
            <button 
              onClick={() => window.location.reload()}
              className="mt-3 text-xs text-red-700 underline underline-offset-4"
            >
              Try Again
            </button>
          </div>
        ) : (
          <div className="prose prose-stone max-w-none">
            {summary.split('\n').map((para, i) => para.trim() && (
              <p key={i} className="text-stone-700 leading-relaxed mb-4 text-base">
                {para}
              </p>
            ))}
          </div>
        )}
      </div>

      <div className="text-center">
        <p className="text-sm text-black-400">
          AI-generated summaries can be inaccurate. Please verify critical information against original documents.
        </p>
      </div>
    </div>
  );
}
