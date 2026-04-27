import { useState, useEffect, useRef } from 'react';
import { api } from '../../services/api.js';

export default function SummaryPage({ caseId, onBack }) {
  const [summary,    setSummary]    = useState('');
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [mode,       setMode]       = useState('case');   // 'case' | 'file'
  const [fileStatus, setFileStatus] = useState('');       // upload status text
  const [source,     setSource]     = useState('text');   // 'text' | 'pdf' | 'image'
  const [dragging,   setDragging]   = useState(false);
  const fileRef = useRef(null);

  // Auto-fetch case summary on mount
  useEffect(() => {
    if (caseId && mode === 'case') fetchCaseSummary();
  }, [caseId]);

  async function fetchCaseSummary() {
    try {
      setLoading(true);
      setError('');
      setSummary('');
      const res = await api.summarize(caseId);
      setSummary(res.data.summary);
      setSource(res.data.source || 'text');
    } catch (err) {
      setError(err.message || 'Failed to generate summary');
    } finally {
      setLoading(false);
    }
  }

  async function handleFileUpload(file) {
    if (!file) return;

    const allowed = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const ext     = file.name.split('.').pop().toLowerCase();
    if (!allowed.includes(file.type) && !['pdf','jpg','jpeg','png','webp'].includes(ext)) {
      setFileStatus('❌ Unsupported file. Please upload a PDF or image (JPG, PNG, WEBP).');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setFileStatus('❌ File too large. Maximum 10 MB.');
      return;
    }

    setMode('file');
    setLoading(true);
    setError('');
    setSummary('');
    setFileStatus(`⏳ Extracting text from "${file.name}"…`);

    try {
      const res = await api.summarizeFile(file);
      setSummary(res.data.summary);
      setSource(res.data.source || 'file');
      setFileStatus(`✅ Summarized from "${file.name}"`);
    } catch (err) {
      setError(err.message || 'File summarization failed');
      setFileStatus('');
    } finally {
      setLoading(false);
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  }

  // Render summary text — detect section headers and bold them
  function renderSummary(text) {
    const headers = ['Overview:', 'Key Facts:', 'Legal Context:', 'Next Steps:'];
    return text.split('\n').filter(l => l.trim()).map((line, i) => {
      const isHeader = headers.some(h => line.trim().startsWith(h));
      return isHeader
        ? <p key={i} className="text-stone-800 font-semibold text-base mt-5 mb-1">{line.trim()}</p>
        : <p key={i} className="text-stone-600 leading-relaxed mb-2 text-sm pl-1">{line.trim()}</p>;
    });
  }

  const sourceLabel = { text: 'Case Description', pdf: 'PDF Document', image: 'Image (OCR)', file: 'Uploaded File' };
  const sourceIcon  = { text: '📋', pdf: '📄', image: '🖼️', file: '📎' };

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

      {/* Tabs: Case text vs File upload */}
      <div className="flex gap-2">
        <button
          onClick={() => { setMode('case'); fetchCaseSummary(); setFileStatus(''); }}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
            mode === 'case'
              ? 'bg-stone-800 text-white border-stone-800'
              : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
          }`}
        >
          📋 Summarize Case
        </button>
        <button
          onClick={() => setMode('file')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
            mode === 'file'
              ? 'bg-stone-800 text-white border-stone-800'
              : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
          }`}
        >
          📄 Summarize File (PDF / Image)
        </button>
      </div>

      {/* File upload zone — visible when "file" tab is active */}
      {mode === 'file' && !loading && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors ${
            dragging
              ? 'border-stone-500 bg-stone-100'
              : 'border-stone-300 bg-stone-50 hover:border-stone-500 hover:bg-stone-100'
          }`}
        >
          <p className="text-4xl mb-2">📁</p>
          <p className="text-stone-600 font-medium text-sm">Drop a PDF or image here</p>
          <p className="text-stone-400 text-xs mt-1">or click to browse · PDF, JPG, PNG, WEBP · max 10 MB</p>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            className="hidden"
            onChange={(e) => handleFileUpload(e.target.files[0])}
          />
        </div>
      )}

      {fileStatus && (
        <p className={`text-xs px-3 py-2 rounded-lg ${
          fileStatus.startsWith('❌') ? 'bg-red-50 text-red-600' :
          fileStatus.startsWith('✅') ? 'bg-green-50 text-green-700' :
          'bg-blue-50 text-blue-600'
        }`}>{fileStatus}</p>
      )}

      {/* Summary card */}
      <div className="bg-white border border-stone-200 rounded-2xl shadow-sm overflow-hidden">

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-4">
            <div className="w-9 h-9 border-4 border-stone-200 border-t-stone-800 rounded-full animate-spin" />
            <p className="text-sm text-stone-500 font-medium">
              {mode === 'file' ? 'Extracting text and generating summary…' : 'Generating AI summary…'}
            </p>
            <p className="text-xs text-stone-400">This may take 15–30 seconds</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <div className="bg-red-50 border border-red-200 rounded-xl p-5 inline-block">
              <p className="text-red-600 text-sm font-medium mb-3">❌ {error}</p>
              <button
                onClick={() => mode === 'case' ? fetchCaseSummary() : setMode('file')}
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
              <span className="text-xs text-stone-500 font-medium">
                Source: {sourceLabel[source] || source}
              </span>
            </div>
            <div>{renderSummary(summary)}</div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-stone-400">
            <p className="text-4xl mb-3">✨</p>
            <p className="text-sm">Upload a file above to summarize it</p>
          </div>
        )}
      </div>

      <p className="text-center text-xs text-stone-400">
        AI-generated summaries may be inaccurate. Verify critical information against original documents.
      </p>
    </div>
  );
}
