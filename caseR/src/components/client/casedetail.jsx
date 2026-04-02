import { useState, useEffect, useRef } from 'react';
import { api }                         from '../../services/api.js';
import { useApp }                      from '../context/appcontext.jsx';

export default function ClientCaseDetail({ caseId, onBack }) {
  const { loading } = useApp();

  const [caseData,  setCaseData]  = useState(null);
  const [matters,   setMatters]   = useState([]);
  const [fetching,  setFetching]  = useState(true);
  const [pageError, setPageError] = useState('');

  // Matter form
  const [matterOpen,     setMatterOpen]     = useState(false);
  const [matterTitle,    setMatterTitle]    = useState('');
  const [matterDesc,     setMatterDesc]     = useState('');
  const [matterPriority, setMatterPriority] = useState('medium');
  const [matterMsg,      setMatterMsg]      = useState('');
  const [matterErr,      setMatterErr]      = useState('');
  const [submitting,     setSubmitting]     = useState(false);

  // Upload
  const [uploading,  setUploading]  = useState(false);
  const [uploadMsg,  setUploadMsg]  = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (caseId) { fetchCase(); fetchMatters(); }
  }, [caseId]);

  async function fetchCase() {
    setFetching(true);
    try {
      const res = await api.getCaseById(caseId);
      setCaseData(res.data.case);
    } catch (err) {
      setPageError(err.message);
    } finally {
      setFetching(false);
    }
  }

  async function fetchMatters() {
    try {
      const res = await api.getMatters(caseId);
      setMatters(res.data.matters || []);
    } catch (err) {
      console.error('Matters:', err.message);
    }
  }

  // Add Matter
  // FIX 3: backend now allows client to POST matters
  async function handleAddMatter(e) {
    e.preventDefault();
    setMatterErr('');
    setMatterMsg('');

    if (!matterTitle.trim()) {
      setMatterErr('Please enter a title');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.createMatter(caseId, {
        title:       matterTitle.trim(),
        description: matterDesc.trim() || undefined,
        priority:    matterPriority,
      });

      const newMatter = res.data?.matter;
      if (newMatter) {
        setMatters(prev => [...prev, newMatter]);
        setMatterTitle('');
        setMatterDesc('');
        setMatterPriority('medium');
        setMatterOpen(false);
        setMatterMsg('✅ Matter added. Your lawyer can see it now.');
        setTimeout(() => setMatterMsg(''), 5000);
      }
    } catch (err) {
      setMatterErr(err.message || 'Failed to add matter');
    } finally {
      setSubmitting(false);
    }
  }

  //  Upload Document 
  // FIX 4: calls api.uploadDocument() which hits fixed backend route
  async function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';

    if (file.size > 10 * 1024 * 1024) {
      setUploadMsg('❌ File too large — maximum 10MB');
      return;
    }

    setUploading(true);
    setUploadMsg('Uploading...');

    try {
      const res = await api.uploadDocument(caseId, file);
      setUploadMsg(`✅ "${file.name}" uploaded`);
      fetchCase(); // refresh to show new doc in list
      setTimeout(() => setUploadMsg(''), 5000);
    } catch (err) {
      setUploadMsg(`❌ Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
    }
  }

  // Download to device
  async function handleDownload(filename) {
    try {
      const token = localStorage.getItem('democase_token');
      const BASE  = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3001';

      const res = await fetch(
        `${BASE}/api/cases/${caseId}/documents/${encodeURIComponent(filename)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!res.ok) throw new Error('Download failed');

      const blob  = await res.blob();
      const url   = window.URL.createObjectURL(blob);
      const a     = document.createElement('a');
      a.href      = url;
      a.download  = filename.replace(/^[A-Z0-9-]+_\d+_/, '') || filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch {
      alert('Download failed. Please try again.');
    }
  }

  if (fetching)   return <p className="p-6 text-stone-400 text-sm">Loading case...</p>;
  if (pageError)  return <div className="p-6"><p className="text-red-600 text-sm mb-3">{pageError}</p><button onClick={onBack} className="text-sm text-stone-500">← Back</button></div>;
  if (!caseData)  return null;

  return (
    <div className="p-6 max-w-4xl space-y-6">

      {/* Header */}
      <div>
        <button onClick={onBack} className="text-sm text-stone-500 hover:text-stone-700 mb-3 block">← Back</button>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-mono text-stone-400 mb-1">{caseData.id}</p>
            <h1 className="text-2xl font-serif font-medium text-stone-800">{caseData.title}</h1>
            <p className="text-sm text-stone-500 mt-1">{caseData.category} · Filed: {caseData.filedDate}</p>
          </div>
          <SBadge status={caseData.status} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* LEFT */}
        <div className="lg:col-span-3 space-y-5">
          <Card title="Description">
            <p className="text-sm text-stone-600 leading-relaxed">{caseData.description}</p>
          </Card>

          <Card title="Timeline ">
            {!caseData.timeline?.length
              ? <p className="text-xl text-stone-400">No events yet</p>
              : <div className="space-y-3">
                  {caseData.timeline.map((ev, i) => (
                    <div key={i} className="flex gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-stone-400 mt-1.5 shrink-0" />
                      <div>
                        <p className="text-base font-medium text-stone-700">{ev.event}</p>
                        <p className="text-sm text-stone-400 mt-0.5">{ev.date} · by {ev.by}</p>
                      </div>
                    </div>
                  ))}
                </div>
            }
          </Card>

          {caseData.lawyerNote && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-xs font-medium text-amber-700 mb-1">📝 Lawyer's Note</p>
              <p className="text-sm text-amber-900">{caseData.lawyerNote}</p>
            </div>
          )}

          {caseData.nextHearing && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-xs font-medium text-blue-700 mb-1">📅 Next Hearing</p>
              <p className="text-lg font-medium text-blue-900">{caseData.nextHearing}</p>
            </div>
          )}
        </div>

        {/* RIGHT */}
        <div className="lg:col-span-2 space-y-5">

          {/* ADD MATTER — FIX 3 */}
          <Card title={`Matters (${matters.length})`}>
            <p className="text-xs text-stone-500 mb-3">
              Add a matter to give your lawyer more information about a specific aspect of your case.
            </p>

            {matters.map(m => (
              <div key={m.id} className="bg-stone-50 border border-stone-200 rounded-lg p-3 mb-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-stone-700">{m.title}</p>
                  <MBadge status={m.status} />
                </div>
                {m.description && <p className="text-xs text-stone-500 mt-1">{m.description}</p>}
                <p className="text-xs text-stone-400 mt-1">Priority: {m.priority}</p>
              </div>
            ))}

            {matterMsg && (
              <p className="text-xs bg-green-50 text-green-700 px-3 py-2 rounded-lg mb-3">{matterMsg}</p>
            )}

            {!matterOpen ? (
              <button
                onClick={() => setMatterOpen(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-stone-300 rounded-xl text-sm text-stone-500 hover:border-stone-500 hover:text-stone-700 transition-colors"
              >
                + Add a Matter
              </button>
            ) : (
              <form onSubmit={handleAddMatter} className="border border-stone-200 rounded-xl p-4 bg-stone-50 space-y-3">
                <div className="flex justify-between items-center">
                  <p className="text-sm font-medium text-stone-700">New Matter</p>
                  <button type="button" onClick={() => { setMatterOpen(false); setMatterErr(''); }} className="text-stone-400 hover:text-stone-600 text-xl">×</button>
                </div>

                <input
                  type="text"
                  value={matterTitle}
                  onChange={e => setMatterTitle(e.target.value)}
                  placeholder="Title of this matter *"
                  required
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-stone-400"
                />

                <textarea
                  value={matterDesc}
                  onChange={e => setMatterDesc(e.target.value)}
                  placeholder="Describe this matter in detail..."
                  rows={3}
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm bg-white focus:outline-none resize-none"
                />

                <select
                  value={matterPriority}
                  onChange={e => setMatterPriority(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm bg-white"
                >
                  <option value="low">Low priority</option>
                  <option value="medium">Medium priority</option>
                  <option value="high">High priority</option>
                  <option value="urgent">Urgent</option>
                </select>

                {matterErr && <p className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">{matterErr}</p>}

                <div className="flex gap-2">
                  <button type="submit" disabled={submitting}
                    className="flex-1 bg-stone-800 text-white text-sm py-2 rounded-lg disabled:opacity-50 hover:bg-stone-700"
                  >
                    {submitting ? 'Adding...' : 'Add Matter'}
                  </button>
                  <button type="button" onClick={() => { setMatterOpen(false); setMatterErr(''); }}
                    className="px-3 py-2 border border-stone-200 rounded-lg text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </Card>

          {/* DOCUMENTS — FIX 4 */}
          <Card title="Documents">
            <p className="text-xs text-stone-500 mb-3">
              Upload files to share with your lawyer. Click ⬇ Save to download any file.
            </p>

            {caseData.documents?.length > 0
              ? <div className="space-y-2 mb-3">
                  {caseData.documents.map((doc, i) => {
                    const name = doc.replace(/^[A-Z0-9-]+_\d+_/, '') || doc;
                    return (
                      <div key={i} className="flex items-center justify-between bg-stone-50 border border-stone-200 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span>📄</span>
                          <p className="text-xs text-stone-700 truncate" title={name}>{name}</p>
                        </div>
                        <button
                          onClick={() => handleDownload(doc)}
                          className="ml-2 text-xs text-stone-500 hover:text-stone-800 underline shrink-0"
                        >
                          ⬇ Save
                        </button>
                      </div>
                    );
                  })}
                </div>
              : <p className="text-xs text-stone-400 mb-3">No documents yet</p>
            }

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-stone-300 rounded-xl text-sm text-stone-500 hover:border-stone-500 hover:text-stone-700 transition-colors disabled:opacity-50"
            >
              {uploading ? 'Uploading...' : '+ Upload Document'}
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              onChange={handleFileSelect}
              className="hidden"
            />

            {uploadMsg && (
              <p className={`text-xs mt-2 px-3 py-2 rounded-lg ${
                uploadMsg.startsWith('❌') ? 'bg-red-50 text-red-600' :
                uploadMsg === 'Uploading...' ? 'bg-blue-50 text-blue-600' :
                'bg-green-50 text-green-700'
              }`}>{uploadMsg}</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-5">
      <h2 className="text-lg font-semibold text-stone-900 mb-3">{title}</h2>
      {children}
    </div>
  );
}

function SBadge({ status }) {
  const s = { pending:'bg-amber-100 text-amber-800', active:'bg-blue-100 text-blue-800', urgent:'bg-red-100 text-red-800', resolved:'bg-green-100 text-green-800', closed:'bg-stone-100 text-stone-600' };
  return <span className={`px-3 py-1 rounded-full text-sm font-medium ${s[status]||s.pending}`}>{status}</span>;
}

function MBadge({ status }) {
  const s = { open:'bg-stone-100 text-stone-600', in_progress:'bg-blue-100 text-blue-700', pending_review:'bg-purple-100 text-purple-700', on_hold:'bg-amber-100 text-amber-700', closed:'bg-green-100 text-green-700' };
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s[status]||s.open}`}>{status?.replace(/_/g,' ')}</span>;
}