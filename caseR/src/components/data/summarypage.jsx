import { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api.js';

export default function SummaryPage({ caseId, onBack }) {
  const [summary, setSummary] = useState('');
  const [documentSummary, setDocumentSummary] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [source, setSource] = useState('text');   // 'text' | 'pdf' | 'image'

  const fetchCaseSummary = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      setSummary('');
      setDocumentSummary('');
      const res = await api.summarize(caseId);
      setSummary(res.data.descriptionSummary || res.data.summary || '');
      setDocumentSummary(res.data.documentSummary || '');
      setSource(res.data.source || 'text');
    } catch (err) {
      setError(err.message || 'Failed to generate summary');
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  // Auto-fetch case summary on mount
  useEffect(() => {
    if (caseId) fetchCaseSummary();
  }, [caseId, fetchCaseSummary]);



  // Render summary text — detect section headers and bold them
  function renderSummary(text) {
    const headers = ['Overview:', 'Key Facts:', 'Legal Context:', 'Next Steps:', 'Attached Document Summary:'];
    return text.split('\n').filter(l => l.trim()).map((line, i) => {
      const isHeader = headers.some(h => line.trim().startsWith(h));
      return isHeader
        ? <p key={i} className="text-stone-800 font-semibold text-base mt-5 mb-1">{line.trim()}</p>
        : <p key={i} className="text-stone-600 leading-relaxed mb-2 text-sm pl-1">{line.trim()}</p>;
    });
  }

  const sourceLabel = { text: 'Case Description', pdf: 'PDF Document', txt: 'Text Document', image: 'Image (OCR)', file: 'Uploaded File' };
  const sourceIcon  = { text: '📋', pdf: '📄', txt: '📝', image: '🖼️', file: '📎' };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-semibold text-stone-800">✨ AI Case Summary</h1>
          <p className="text-xs text-stone-400 mt-0.5">Powered by Ollama · phi model</p>
        </div>
        <button
          onClick={onBack}
          className="px-4 py-2 border border-stone-200 rounded-lg text-sm text-stone-600 hover:bg-stone-50 transition-colors"
        >
          ← Return to Case
        </button>
      </div>



      {/* Description summary card */}
      <div className="bg-white border border-stone-200 rounded-2xl shadow-sm overflow-hidden">

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-4">
            <div className="w-9 h-9 border-4 border-stone-200 border-t-stone-800 rounded-full animate-spin" />
            <p className="text-sm text-stone-500 font-medium">
              Generating AI summary…
            </p>
            <p className="text-xs text-stone-400">This may take 15–30 seconds</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <div className="bg-red-50 border border-red-200 rounded-xl p-5 inline-block">
              <p className="text-red-600 text-sm font-medium mb-3">❌ {error}</p>
              <button
                onClick={() => fetchCaseSummary()}
                className="text-xs text-red-700 underline underline-offset-4"
              >
                Try Again
              </button>
            </div>
          </div>
        ) : summary ? (
          <div className="p-8">
            {/* Source badge */}
            <div className="flex items-center gap-2 mb-5 pb-4 border-b border-stone-100">
              <span className="text-lg">{sourceIcon[source] || '📋'}</span>
              <span className="text-xs text-stone-500 font-medium">Source: {sourceLabel[source] || 'Case Description'}</span>
            </div>
            <div>{renderSummary(summary)}</div>
          </div>
        ) : null}
      </div>

      {!loading && !error && documentSummary ? (
        <div className="bg-white border border-stone-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-8">
            <div className="flex items-center gap-2 mb-5 pb-4 border-b border-stone-100">
              <span className="text-lg">{sourceIcon[source] || '📄'}</span>
              <span className="text-xs text-stone-500 font-medium">
                Source: {sourceLabel[source] || 'Uploaded File'}
              </span>
            </div>
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-stone-800">AI PDF Document Summary</h2>
            </div>
            <div>{renderSummary(documentSummary)}</div>
          </div>
        </div>
      ) : null}

      <p className="text-center text-xs text-stone-400">
        AI-generated summaries may be inaccurate. Verify critical information against original documents.
      </p>
    </div>
  );
}
