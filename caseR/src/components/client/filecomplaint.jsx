import { useState, useRef } from 'react';
import { useApp }           from '../context/appcontext.jsx';
import { api }              from '../../services/api.js';

export default function FileComplaint({ onSuccess }) {
  const { fileComplaint } = useApp();

  const [title,       setTitle]       = useState('');
  const [category,    setCategory]    = useState('Civil');
  const [priority,    setPriority]    = useState('medium');
  const [description, setDescription] = useState('');

  // Files to upload — array of { file: File, status: 'pending'|'uploading'|'done'|'error' }
  const [selectedFiles,  setSelectedFiles]  = useState([]);
  const [submitting,     setSubmitting]     = useState(false);
  const [submitStatus,   setSubmitStatus]   = useState(''); // overall status message
  const [error,          setError]          = useState('');
  const [success,        setSuccess]        = useState(null);

  const fileInputRef = useRef(null);

  // File selection
  function handleFileSelect(e) {
    const newFiles = Array.from(e.target.files);
    e.target.value = ''; // reset so same file can be re-selected

    const valid   = newFiles.filter(f => f.size <= 10 * 1024 * 1024);
    const toolarge = newFiles.filter(f => f.size  > 10 * 1024 * 1024);

    if (toolarge.length > 0) {
      setError(`Skipped (>10MB): ${toolarge.map(f => f.name).join(', ')}`);
    }

    setSelectedFiles(prev => {
      const existingNames = new Set(prev.map(item => item.file.name));
      const toAdd = valid
        .filter(f => !existingNames.has(f.name))
        .map(f => ({ file: f, status: 'pending' }));
      return [...prev, ...toAdd];
    });
  }

  function removeFile(name) {
    setSelectedFiles(prev => prev.filter(item => item.file.name !== name));
  }

  // Update status of a single file in the list
  function setFileStatus(name, status) {
    setSelectedFiles(prev =>
      prev.map(item => item.file.name === name ? { ...item, status } : item)
    );
  }

  // Form submit
  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitStatus('');

    if (description.length < 10) {
      setError('Description must be at least 10 characters');
      return;
    }

    setSubmitting(true);

    // STEP 1: Create the case 
    setSubmitStatus('Filing your complaint...');

    const result = await fileComplaint({ title, category, priority, description });

    if (!result.success) {
      setError(result.message);
      setSubmitting(false);
      setSubmitStatus('');
      return;
    }

    const newCase = result.case; // has newCase.id we need for uploads

    // STEP 2: Upload each file one by one 
    // We use the newCase.id returned from step 1.
    // Each file is uploaded sequentially to avoid overwhelming the server.
    if (selectedFiles.length > 0) {
      setSubmitStatus(`Uploading ${selectedFiles.length} document(s)...`);

      for (const item of selectedFiles) {
        setFileStatus(item.file.name, 'uploading');
        try {
          await api.uploadDocument(newCase.id, item.file);
          setFileStatus(item.file.name, 'done');
        } catch (uploadErr) {
          setFileStatus(item.file.name, 'error');
          console.error(`Upload failed for ${item.file.name}:`, uploadErr.message);
        }
      }
    }

    setSubmitStatus('');
    setSubmitting(false);
    setSuccess(newCase);

    // Clear form (AFTER uploads complete — not before)
    setTitle('');
    setCategory('Civil');
    setPriority('medium');
    setDescription('');
    setSelectedFiles([]);
  }

  // Success screen
  if (success) {
    return (
      <div className="p-6 max-w-lg mx-auto">
        <div className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center">
          <div className="text-4xl mb-4">✅</div>
          <h2 className="text-xl font-serif font-medium text-green-800 mb-2">
            Complaint Filed Successfully
          </h2>
          <div className="bg-white border border-green-200 rounded-xl px-5 py-4 mb-4 inline-block">
            <p className="text-xs text-green-600 mb-1">Your Case ID</p>
            <p className="text-2xl font-mono font-semibold text-green-800">{success.id}</p>
          </div>
          <p className="text-xs text-green-600 mb-5">
            You can now add more information or upload more documents from the case page.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => onSuccess && onSuccess(success.id)}
              className="px-5 py-2.5 bg-stone-800 text-white rounded-xl text-sm font-medium hover:bg-stone-700"
            >
              View My Case →
            </button>
            <button
              onClick={() => setSuccess(null)}
              className="px-5 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-600 hover:bg-stone-50"
            >
              File Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main form
  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-serif font-medium text-stone-800 mb-6">File a Complaint</h1>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1.5">
            Case Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            required
            minLength={5}
            placeholder="Brief title of your legal issue"
            className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
          />
        </div>

        {/* Category + Priority */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1.5">Category <span className="text-red-500">*</span></label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm bg-white focus:outline-none"
            >
              <option value="Civil">Civil</option>
              <option value="Criminal">Criminal</option>
              <option value="Family">Family</option>
              <option value="Consumer">Consumer</option>
              <option value="Labour">Labour</option>
              <option value="Corporate">Corporate</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1.5">Priority</label>
            <select
              value={priority}
              onChange={e => setPriority(e.target.value)}
              className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm bg-white focus:outline-none"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1.5">
            Description <span className="text-red-500">*</span>
          </label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            required
            rows={5}
            placeholder="Describe your legal issue in detail..."
            className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-stone-400 resize-none"
          />
          <p className="text-xs text-stone-400 mt-1">Minimum 10 characters · {description.length} / 5000</p>
        </div>

        {/*Document upload section*/}
        <div className="border border-stone-200 rounded-xl p-4 bg-stone-50">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-medium text-stone-700">Supporting Documents</p>
              <p className="text-xs text-stone-400 mt-0.5">Attach any relevant files (optional)</p>
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-xs font-medium text-stone-700 hover:bg-stone-100"
            >
              + Add Files
            </button>
          </div>

          {/* File input — MULTIPLE attribute fixed */}
          <input
            ref={fileInputRef}
            type="file"
            multiple                  // ← FIX: allows selecting multiple files
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            onChange={handleFileSelect}
            className="hidden"
          />

          {selectedFiles.length === 0 ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-stone-200 rounded-xl p-5 text-center cursor-pointer hover:border-stone-400 transition-colors"
            >
              <p className="text-xs text-stone-400">Click "+ Add Files" or drag files here</p>
              <p className="text-xs text-stone-300 mt-0.5">PDF, JPG, PNG, DOC · Max 10MB each</p>
            </div>
          ) : (
            <div className="space-y-2">
              {selectedFiles.map(item => (
                <div key={item.file.name} className="flex items-center justify-between bg-white border border-stone-200 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {/* Status icon */}
                    <span className="text-base shrink-0">
                      {item.status === 'done'      && '✅'}
                      {item.status === 'error'     && '❌'}
                      {item.status === 'uploading' && '⏳'}
                      {item.status === 'pending'   && '📄'}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-stone-700 truncate">{item.file.name}</p>
                      <p className="text-xs text-stone-400">
                        {(item.file.size / 1024).toFixed(0)} KB
                        {item.status === 'uploading' && ' · uploading...'}
                        {item.status === 'done'      && ' · uploaded'}
                        {item.status === 'error'     && ' · failed'}
                      </p>
                    </div>
                  </div>
                  {/* Only allow removing if not uploading */}
                  {item.status !== 'uploading' && item.status !== 'done' && (
                    <button
                      type="button"
                      onClick={() => removeFile(item.file.name)}
                      className="ml-2 text-stone-400 hover:text-red-500 text-lg leading-none"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Errors and status */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {submitStatus && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-700">
            {submitStatus}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting}
          className="px-6 py-3 bg-stone-800 text-white rounded-xl text-sm font-medium hover:bg-stone-700 disabled:opacity-50 transition-colors"
        >
          {submitting ? 'Please wait...' : 'Submit Complaint'}
        </button>
      </form>
    </div>
  );
}