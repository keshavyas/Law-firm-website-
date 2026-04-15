import { useState, useEffect, useRef } from 'react';
import { api }                         from '../../services/api.js';
import { useApp }                      from '../context/appcontext.jsx';

export default function LawyerCaseDetail({ caseId, onBack, onNavigate }) {
  const { updateCaseStatus, loading } = useApp();

  const [caseData,   setCaseData]   = useState(null);
  const [matters,    setMatters]    = useState([]);
  const [fetching,   setFetching]   = useState(true);
  const [pageError,  setPageError]  = useState('');
  const [uploading,  setUploading]  = useState(false);
  const [uploadMsg,  setUploadMsg]  = useState('');

  // Case update form
  const [newStatus,   setNewStatus]   = useState('');
  const [lawyerNote,  setLawyerNote]  = useState('');
  const [nextHearing, setNextHearing] = useState('');
  const [updating,    setUpdating]    = useState(false);
  const [updateMsg,   setUpdateMsg]   = useState('');

  // Matter form
  const [matterOpen,     setMatterOpen]     = useState(false);
  const [matterTitle,    setMatterTitle]    = useState('');
  const [matterDesc,     setMatterDesc]     = useState('');
  const [matterPriority, setMatterPriority] = useState('medium');
  const [matterMsg,      setMatterMsg]      = useState('');
  const [submitting,     setSubmitting]     = useState(false);

  // Matter transition
  const [transitioningId,  setTransitioningId]  = useState(null);
  const [transitionStatus, setTransitionStatus] = useState('');
  const [transitionReason, setTransitionReason] = useState('');
  const [transitionError,  setTransitionError]  = useState('');

  const fileInputRef = useRef(null);

  useEffect(() => {
    if (caseId) { fetchCase(); fetchMatters(); }
  }, [caseId]);

  async function fetchCase() {
    setFetching(true);
    try {
      const res = await api.getCaseById(caseId);
      const c   = res.data.case;
      setCaseData(c);
      setNewStatus(c.status);
      setLawyerNote(c.lawyerNote || '');
      setNextHearing(c.nextHearing || '');
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
      console.error('Matters error:', err.message);
    }
  }

  async function handleCaseUpdate(e) {
    e.preventDefault();
    setUpdating(true);
    setUpdateMsg('');
    const result = await updateCaseStatus(caseId, { status: newStatus, lawyerNote, nextHearing: nextHearing || null });
    if (result.success) { setCaseData(result.case); setUpdateMsg('✅ Updated'); }
    else                { setUpdateMsg(`❌ ${result.message}`); }
    setUpdating(false);
    setTimeout(() => setUpdateMsg(''), 4000);
  }

  // Document upload — FIX 4 
  // Uses api.uploadDocument() which calls the fixed backend route.
  // Backend now uses Case.findByPk() directly so .save() works
  // for lawyers too (previously threw because of ownership check).
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
      await api.uploadDocument(caseId, file);
      setUploadMsg(`✅ "${file.name}" uploaded`);
      fetchCase(); // refresh so the new doc appears in the list
      setTimeout(() => setUploadMsg(''), 5000);
    } catch (err) {
      setUploadMsg(`❌ Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
    }
  }

  // Download to device 
  async function handleDownload(filename) {
    console.log('Lawyer starting download for:', filename);
    try {
      const token = localStorage.getItem('democase_token');
      const BASE  = import.meta.env.VITE_API_URL !== undefined ? import.meta.env.VITE_API_URL : '';
      const url   = `${BASE}/api/cases/${caseId}/documents/${encodeURIComponent(filename)}`;
      
      console.log('Fetching from:', url);
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });

      if (!res.ok) {
        console.error('Lawyer download failed:', res.status, res.statusText);
        throw new Error('Download failed');
      }

      const blob = await res.blob();
      console.log('Blob received:', blob.size, 'bytes');
      
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename.replace(/^[A-Z0-9-]+_\d+_/, '') || filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Lawyer handleDownload Error:', err);
      alert('Download failed. Please try again.');
    }
  }

  async function handleAddMatter(e) {
    e.preventDefault();
    if (!matterTitle.trim()) return;
    setSubmitting(true);
    setMatterMsg('');
    try {
      const res = await api.createMatter(caseId, { title: matterTitle.trim(), description: matterDesc.trim() || undefined, priority: matterPriority });
      if (res.data?.matter) {
        setMatters(prev => [...prev, res.data.matter]);
        setMatterTitle(''); setMatterDesc(''); setMatterPriority('medium');
        setMatterOpen(false);
        setMatterMsg('✅ Matter added');
        setTimeout(() => setMatterMsg(''), 3000);
      }
    } catch (err) {
      setMatterMsg(`❌ ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTransition(matterId) {
    if (!transitionStatus) return;
    setTransitionError('');
    try {
      const res = await api.transitionMatter(matterId, transitionStatus, transitionReason);
      setMatters(prev => prev.map(m => m.id === matterId ? res.data.matter : m));
      setTransitioningId(null); setTransitionStatus(''); setTransitionReason('');
    } catch (err) {
      setTransitionError(err.message);
    }
  }

  if (fetching)  return <p className="p-6 text-stone-400 text-sm">Loading case...</p>;
  if (pageError) return <div className="p-6"><p className="text-red-600 text-sm mb-3">{pageError}</p><button onClick={onBack} className="text-sm text-stone-500">← Back</button></div>;
  if (!caseData) return null;

  return (
    <div className="p-6 space-y-6">

      <div>
        <div className="flex justify-between items-center mb-3">
          <button onClick={onBack} className="text-sm text-stone-500 hover:text-stone-700 block">← Back to cases</button>
          <button 
            onClick={() => onNavigate('summary', caseId)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 text-stone-700 rounded-lg text-xs font-medium hover:bg-stone-200 transition-colors border border-stone-200"
          >
            ✨ AI Summarize
          </button>
        </div>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-mono text-stone-400 mb-1">{caseData.id}</p>
            <h1 className="text-2xl font-serif font-medium text-stone-800">{caseData.title}</h1>
            <p className="text-sm text-stone-500 mt-1">{caseData.category} · Client: {caseData.clientName}</p>
          </div>
          <SBadge status={caseData.status} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* MAIN */}
        <div className="lg:col-span-2 space-y-5">
          <Card title="Description">
            <p className="text-sm text-stone-600 leading-relaxed">{caseData.description}</p>
          </Card>

          <Card title="Timeline">
            {!caseData.timeline?.length
              ? <p className="text-xs text-stone-400">No events</p>
              : <div className="space-y-3">
                  {caseData.timeline.map((ev, i) => (
                    <div key={i} className="flex gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-stone-400 mt-1.5 shrink-0" />
                      <div>
                        <p className="text-sm text-stone-700">{ev.event}</p>
                        <p className="text-xs text-stone-400 mt-0.5">{ev.date} · by {ev.by}</p>
                      </div>
                    </div>
                  ))}
                </div>
            }
          </Card>

          {/* Matters */}
          <Card title={`Matters (${matters.length})`}>
            {matters.length === 0
              ? <p className="text-xs text-stone-400 mb-3">No matters yet</p>
              : <div className="space-y-3 mb-3">
                  {matters.map(m => (
                    <div key={m.id} className="border border-stone-200 rounded-xl p-4">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div>
                          <p className="text-sm font-medium text-stone-800">{m.title}</p>
                          {m.description && <p className="text-xs text-stone-500 mt-0.5">{m.description}</p>}
                        </div>
                        <MBadge status={m.status} />
                      </div>
                      <p className="text-xs text-stone-400">Priority: {m.priority}</p>

                      {m.status !== 'closed' && (
                        transitioningId === m.id ? (
                          <div className="mt-2 pt-2 border-t border-stone-100 space-y-2">
                            <select value={transitionStatus} onChange={e => setTransitionStatus(e.target.value)}
                              className="w-full text-xs px-2 py-1.5 border border-stone-200 rounded-lg bg-white"
                            >
                              <option value="">Select new status...</option>
                              <option value="in_progress">in_progress</option>
                              <option value="pending_review">pending_review</option>
                              <option value="on_hold">on_hold</option>
                              <option value="closed">closed</option>
                            </select>
                            <input type="text" value={transitionReason} onChange={e => setTransitionReason(e.target.value)}
                              placeholder="Reason (optional)"
                              className="w-full text-xs px-2 py-1.5 border border-stone-200 rounded-lg"
                            />
                            {transitionError && <p className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">{transitionError}</p>}
                            <div className="flex gap-2">
                              <button onClick={() => handleTransition(m.id)} className="text-xs px-3 py-1.5 bg-stone-800 text-white rounded-lg">Confirm</button>
                              <button onClick={() => { setTransitioningId(null); setTransitionError(''); }} className="text-xs px-3 py-1.5 border border-stone-200 rounded-lg">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => setTransitioningId(m.id)} className="text-xs text-stone-500 hover:text-stone-700 mt-1">Update status →</button>
                        )
                      )}
                    </div>
                  ))}
                </div>
            }

            {matterMsg && <p className={`text-xs px-3 py-2 rounded-lg mb-3 ${matterMsg.startsWith('❌') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>{matterMsg}</p>}

            {!matterOpen ? (
              <button onClick={() => setMatterOpen(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-stone-200 rounded-xl text-sm text-stone-500 hover:border-stone-400 hover:text-stone-700"
              >
                + Add a Matter
              </button>
            ) : (
              <form onSubmit={handleAddMatter} className="border border-stone-200 rounded-xl p-4 bg-stone-50 space-y-3">
                <div className="flex justify-between"><p className="text-sm font-medium text-stone-700">New Matter</p><button type="button" onClick={() => setMatterOpen(false)} className="text-stone-400 text-xl">×</button></div>
                <input type="text" value={matterTitle} onChange={e => setMatterTitle(e.target.value)} placeholder="Title *" required className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm bg-white focus:outline-none" />
                <textarea value={matterDesc} onChange={e => setMatterDesc(e.target.value)} placeholder="Description (optional)" rows={2} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm bg-white focus:outline-none resize-none" />
                <select value={matterPriority} onChange={e => setMatterPriority(e.target.value)} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm bg-white">
                  <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option>
                </select>
                <div className="flex gap-2">
                  <button type="submit" disabled={submitting} className="flex-1 bg-stone-800 text-white text-sm py-2 rounded-lg disabled:opacity-50">{submitting ? 'Adding...' : 'Add'}</button>
                  <button type="button" onClick={() => setMatterOpen(false)} className="px-3 py-2 border border-stone-200 rounded-lg text-sm">Cancel</button>
                </div>
              </form>
            )}
          </Card>
        </div>

        {/* SIDEBAR */}
        <div className="space-y-5">

          {/* ── DOCUMENTS — FIX 4 */}
          <Card title="Documents">
            <p className="text-xs text-stone-500 mb-3">
              Files from this case. Click ⬇ Save to download to your device.
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
                        <button onClick={() => handleDownload(doc)} className="ml-2 text-xs text-stone-500 hover:text-stone-800 underline shrink-0">⬇ Save</button>
                      </div>
                    );
                  })}
                </div>
              : <p className="text-xs text-stone-400 mb-3">No documents yet</p>
            }

            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-stone-300 rounded-xl text-sm text-stone-500 hover:border-stone-400 hover:text-stone-700 disabled:opacity-50"
            >
              {uploading ? 'Uploading...' : '+ Upload for Client'}
            </button>
            <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={handleFileSelect} className="hidden" />
            {uploadMsg && <p className={`text-xs mt-2 px-3 py-2 rounded-lg ${uploadMsg.startsWith('❌') ? 'bg-red-50 text-red-600' : uploadMsg === 'Uploading...' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-700'}`}>{uploadMsg}</p>}
          </Card>

          {/* Update case */}
          <Card title="Update Case">
            <form onSubmit={handleCaseUpdate} className="space-y-3">
              <div>
                <label className="text-xs text-stone-500 block mb-1">Status</label>
                <select value={newStatus} onChange={e => setNewStatus(e.target.value)} className="w-full text-sm px-3 py-2 border border-stone-200 rounded-xl bg-white">
                  <option value="pending">Pending</option><option value="active">Active</option><option value="urgent">Urgent</option><option value="resolved">Resolved</option><option value="closed">Closed</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-stone-500 block mb-1">Note to client</label>
                <textarea value={lawyerNote} onChange={e => setLawyerNote(e.target.value)} rows={3} placeholder="Add a note for the client..." className="w-full text-sm px-3 py-2 border border-stone-200 rounded-xl resize-none bg-white" />
              </div>
              <div>
                <label className="text-xs text-stone-500 block mb-1">Next Hearing</label>
                <input type="date" value={nextHearing} onChange={e => setNextHearing(e.target.value)} className="w-full text-sm px-3 py-2 border border-stone-200 rounded-xl bg-white" />
              </div>
              {updateMsg && <p className={`text-xs px-2 py-1 rounded ${updateMsg.startsWith('❌') ? 'text-red-600 bg-red-50' : 'text-green-700 bg-green-50'}`}>{updateMsg}</p>}
              <button type="submit" disabled={updating} className="w-full bg-stone-800 text-white text-sm py-2.5 rounded-xl disabled:opacity-50 hover:bg-stone-700">
                {updating ? 'Updating...' : 'Update Case'}
              </button>
            </form>
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