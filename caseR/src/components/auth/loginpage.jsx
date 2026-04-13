import { useState } from 'react';
import { useApp }   from '../context/appcontext.jsx';
import { api }      from '../../services/api.js';

export default function LoginPage() {
  const { login } = useApp();

  // "login" or "register"
  const [tab, setTab] = useState('login');

  // Login state 
  const [loginEmail,    setLoginEmail]    = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginRole,     setLoginRole]     = useState('client');
  const [loginError,    setLoginError]    = useState('');
  const [loginLoading,  setLoginLoading]  = useState(false);

  //  Register state
  const [regName,      setRegName]      = useState('');
  const [regEmail,     setRegEmail]     = useState('');
  const [regPassword,  setRegPassword]  = useState('');
  const [regConfirm,   setRegConfirm]   = useState('');
  const [regRole,      setRegRole]      = useState('client');
  const [regPhone,     setRegPhone]     = useState('');
  const [regFirm,      setRegFirm]      = useState('');      // lawyer only
  const [regError,     setRegError]     = useState('');
  const [regLoading,   setRegLoading]   = useState(false);
  const [regSuccess,   setRegSuccess]   = useState('');

  // Handle Login 
  async function handleLogin(e) {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    const result = await login(loginEmail, loginPassword, loginRole);
    if (!result.success) setLoginError(result.message);
    setLoginLoading(false);
  }

  // Handle Register 
  async function handleRegister(e) {
    e.preventDefault();
    setRegError('');
    setRegSuccess('');

    if (regPassword !== regConfirm) {
      setRegError('Passwords do not match');
      return;
    }
    if (regPassword.length < 6) {
      setRegError('Password must be at least 6 characters');
      return;
    }

    setRegLoading(true);
    try {
      // Step 1: Create account in database
      await api.register({
        name:  regName.trim(),
        email: regEmail.trim().toLowerCase(),
        password: regPassword,
        role: regRole,
        phone: regPhone || undefined,
        firm:  regFirm  || undefined,
      });

      setRegSuccess('Account created! Signing you in...');

      // Step 2: Auto-login with new credentials
      const result = await login(regEmail.trim().toLowerCase(), regPassword, regRole);
      if (!result.success) {
        setRegError('Account created but auto-login failed. Please login manually.');
        setTab('login');
        setLoginEmail(regEmail.trim().toLowerCase());
        setLoginRole(regRole);
      }
      // On success, App.jsx reads user from context and shows dashboard

    } catch (err) {
      setRegError(err.message || 'Registration failed. Please try again.');
    } finally {
      setRegLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
      <div className="bg-white border border-stone-200 rounded-2xl shadow-sm w-full max-w-md p-8">

        {/* Logo */}
        <div className="text-center mb-7">
          <div className="text-3xl font-serif font-medium text-stone-800 mb-1">⚖️ LegalCase</div>
          <p className="text-stone-500 text-sm"> demo-Legal Case Management</p>
        </div>

        {/* Tab switcher — Login / Register */}
        <div className="flex rounded-xl border border-stone-200 p-1 mb-6">
          <button
            type="button"
            onClick={() => { setTab('login'); setLoginError(''); }}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === 'login' ? 'bg-stone-800 text-white' : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => { setTab('register'); setRegError(''); setRegSuccess(''); }}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === 'register' ? 'bg-stone-800 text-white' : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            Register
          </button>
        </div>

        {/*LOGIN FORM*/}
        {tab === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">

            {/* Role */}
            <div>
              <p className="text-xs font-medium text-stone-500 mb-2">I am a</p>
              <div className="flex gap-4">
                {['client', 'lawyer'].map(r => (
                  <label key={r} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="loginRole"
                      value={r}
                      checked={loginRole === r}
                      onChange={() => setLoginRole(r)}
                      className="accent-stone-800"
                    />
                    <span className="text-sm text-stone-700 capitalize">{r}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Email</label>
              <input
                type="email"
                value={loginEmail}
                onChange={e => setLoginEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Password</label>
              <input
                type="password"
                value={loginPassword}
                onChange={e => setLoginPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
              />
            </div>

            {loginError && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-sm text-red-700">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full bg-stone-800 text-white py-3 rounded-xl text-sm font-medium hover:bg-stone-700 disabled:opacity-50 transition-colors"
            >
              {loginLoading ? 'Signing in...' : 'Sign In'}
            </button>

            <p className="text-center text-xs text-stone-400 mt-2">
              New user?{' '}
              <button
                type="button"
                onClick={() => setTab('register')}
                className="text-stone-600 underline hover:text-stone-800"
              >
                Create an account
              </button>
            </p>
          </form>
        )}

        {/*  REGISTER FORM */}
        {tab === 'register' && (
          <form onSubmit={handleRegister} className="space-y-4">

            {/* Role selector */}
            <div>
              <p className="text-xs font-medium text-stone-500 mb-2">Registering as</p>
              <div className="flex rounded-xl border border-stone-200 p-1">
                {['client', 'lawyer'].map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRegRole(r)}
                    className={`flex-1 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${
                      regRole === r ? 'bg-stone-800 text-white' : 'text-stone-500 hover:text-stone-700'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={regName}
                onChange={e => setRegName(e.target.value)}
                placeholder={regRole === 'lawyer' ? 'Adv. xyz' : 'xyz'}
                required
                minLength={2}
                className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={regEmail}
                onChange={e => setRegEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
              />
            </div>

            {/* Lawyer-only field */}
            {regRole === 'lawyer' && (
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Law Firm</label>
                <input
                  type="text"
                  value={regFirm}
                  onChange={e => setRegFirm(e.target.value)}
                  placeholder="Example & Associates"
                  className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
                />
              </div>
            )}

            {/* Client-only field */}
            {regRole === 'client' && (
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Phone Number</label>
                <input
                  type="text"
                  value={regPhone}
                  onChange={e => setRegPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Password <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={regPassword}
                onChange={e => setRegPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                required
                minLength={6}
                className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Confirm Password <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={regConfirm}
                onChange={e => setRegConfirm(e.target.value)}
                placeholder="Re-enter password"
                required
                className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
              />
            </div>

            {regError && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-sm text-red-700">
                {regError}
              </div>
            )}

            {regSuccess && (
              <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 text-sm text-green-700">
                {regSuccess}
              </div>
            )}

            <button
              type="submit"
              disabled={regLoading}
              className="w-full bg-stone-800 text-white py-3 rounded-xl text-sm font-medium hover:bg-stone-700 disabled:opacity-50 transition-colors"
            >
              {regLoading ? 'Creating account...' : `Create ${regRole} account`}
            </button>

            <p className="text-center text-xs text-stone-400 mt-2">
              Already registered?{' '}
              <button
                type="button"
                onClick={() => setTab('login')}
                className="text-stone-600 underline hover:text-stone-800"
              >
                Sign in
              </button>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
