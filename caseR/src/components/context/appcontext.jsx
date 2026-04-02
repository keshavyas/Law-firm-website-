import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, tokenHelpers, userHelpers } from '../../services/api.js';

// Create the context object
const AppContext = createContext(null);

// Custom hook for easy access — components use useApp() instead of useContext(AppContext)
export function useApp() {
  return useContext(AppContext);
}

export function AppProvider({ children }) {

  // ── STATE ────────────────────────────────────────────────────
  const [user,    setUser]    = useState(null);    // logged-in user object
  const [cases,   setCases]   = useState([]);      // array of cases
  const [stats,   setStats]   = useState(null);    // dashboard stats (lawyer)
  const [loading, setLoading] = useState(false);   // global loading state
  const [error,   setError]   = useState(null);    // global error message

  // ── INITIALISE: restore session from localStorage ────────────
  // When the page refreshes, check if user was already logged in.
  // If token exists in localStorage, restore the user session.
  useEffect(() => {
    const savedUser = userHelpers.get();
    if (savedUser && tokenHelpers.exists()) {
      setUser(savedUser);
    }
  }, []);

  // ── AUTH FUNCTIONS ───────────────────────────────────────────

  // login — called by LoginPage.jsx
  // Calls api.login(), saves token and user to localStorage,
  // then updates the user state to trigger re-render
  async function login(email, password, role) {
    setLoading(true);
    setError(null);
    try {
      const response = await api.login(email, password, role);
      // response.data = { token, user }

      // Save token and user to localStorage for session persistence
      tokenHelpers.save(response.data.token);
      userHelpers.save(response.data.user);

      // Update React state — triggers re-render and shows dashboard
      setUser(response.data.user);
      return { success: true };

    } catch (err) {
      setError(err.message);
      return { success: false, message: err.message };
    } finally {
      setLoading(false);
    }
  }

  // logout — clears everything
  function logout() {
    tokenHelpers.clear();
    userHelpers.clear();
    setUser(null);
    setCases([]);
    setStats(null);
  }

  // ── CASE FUNCTIONS ───────────────────────────────────────────

  // loadCases — fetches cases from backend
  // Called when dashboard mounts or when filters change
  const loadCases = useCallback(async (filters = {}) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.getCases(filters);
      setCases(response.data.cases);
      return response.data;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // loadStats — fetches dashboard stats (lawyer only)
  const loadStats = useCallback(async () => {
    try {
      const response = await api.getCaseStats();
      setStats(response.data);
      return response.data;
    } catch (err) {
      setError(err.message);
      return null;
    }
  }, []);

  // fileComplaint — called by FileComplaint.jsx (client)
  // POSTs new case to backend, then adds it to local state
  async function fileComplaint(formData) {
    setLoading(true);
    setError(null);
    try {
      const response = await api.createCase(formData);
      const newCase  = response.data.case;

      // Add new case to local cases array (no need to refetch all)
      setCases(prev => [newCase, ...prev]);
      return { success: true, case: newCase };

    } catch (err) {
      setError(err.message);
      return { success: false, message: err.message };
    } finally {
      setLoading(false);
    }
  }

  // updateCaseStatus — called by CaseDetail.jsx (lawyer)
  async function updateCaseStatus(caseId, updates) {
    setLoading(true);
    setError(null);
    try {
      const response    = await api.updateCase(caseId, updates);
      const updatedCase = response.data.case;

      // Update the specific case in the local cases array
      // instead of refetching all cases
      setCases(prev =>
        prev.map(c => c.id === caseId ? updatedCase : c)
      );
      return { success: true, case: updatedCase };

    } catch (err) {
      setError(err.message);
      return { success: false, message: err.message };
    } finally {
      setLoading(false);
    }
  }

  // ── MATTER FUNCTIONS (Day 13) ────────────────────────────────

  // createMatter — called by matter creation form
  async function createMatter(caseId, matterData) {
    setLoading(true);
    setError(null);
    try {
      const response = await api.createMatter(caseId, matterData);
      return { success: true, matter: response.data.matter };
    } catch (err) {
      setError(err.message);
      return { success: false, message: err.message };
    } finally {
      setLoading(false);
    }
  }

  // transitionMatter — called by matter status buttons
  async function transitionMatter(matterId, status, reason) {
    setLoading(true);
    setError(null);
    try {
      const response = await api.transitionMatter(matterId, status, reason);
      return { success: true, matter: response.data.matter };
    } catch (err) {
      // Return the error message — it tells what transitions are allowed
      setError(err.message);
      return { success: false, message: err.message };
    } finally {
      setLoading(false);
    }
  }

  // ── CONTEXT VALUE ────────────────────────────────────────────
  // Everything listed here is available to ALL child components
  const value = {
    // State
    user,
    cases,
    stats,
    loading,
    error,

    // Auth
    login,
    logout,

    // Cases
    loadCases,
    loadStats,
    fileComplaint,
    updateCaseStatus,

    // Matters
    createMatter,
    transitionMatter,

    // Helper to clear error
    clearError: () => setError(null),
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

export default AppContext;
