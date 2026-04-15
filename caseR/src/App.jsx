import { useState }            from 'react';
import { AppProvider, useApp } from '../src/components/context/appcontext.jsx';
import LoginPage               from './components/auth/loginpage.jsx';
import LawyerDashboard         from './components/lawyer/lawyerdashboard.jsx';
import CaseList                from './components/lawyer/caselist.jsx';
import LawyerCaseDetail        from './components/lawyer/casedetail.jsx';
import ClientDashboard         from './components/client/clientdashboard.jsx';
import ClientCaseDetail        from './components/client/casedetail.jsx';
import FileComplaint           from './components/client/filecomplaint.jsx';
import Sidebar                 from './components/layout/sidebar.jsx';
import Navbar                  from './components/layout/navbar.jsx';
import SummaryPage             from './components/data/summarypage.jsx';

function AppShell() {
  const { user, logout } = useApp();
  const [currentView,    setCurrentView]    = useState('dashboard');
  const [selectedCaseId, setSelectedCaseId] = useState(null);

  function navigate(view, id = null) {
    setCurrentView(view);
    if (id) setSelectedCaseId(id);
  }

  if (!user) return <LoginPage />;

  function renderContent() {
    switch (currentView) {

      case 'dashboard':
        return user.role === 'lawyer'
          ? <LawyerDashboard onNavigate={navigate} />
          : <ClientDashboard onNavigate={navigate} />;

      case 'cases':
        return <CaseList onNavigate={navigate} />;

      // Lawyer sees full case detail with document upload + matter management
      case 'case-detail':
        return (
          <LawyerCaseDetail
            caseId={selectedCaseId}
            onBack={() => navigate('cases')}
            onNavigate={navigate}
          />
        );

      // Client sees their case with add matter + upload document
      case 'client-case-detail':
        return (
          <ClientCaseDetail
            caseId={selectedCaseId}
            onBack={() => navigate('dashboard')}
            onNavigate={navigate}
          />
        );

      case 'file-complaint':
        return (
          <FileComplaint
            // After filing, go directly to the new case detail page
            // so client can immediately add matters or upload more docs
            onSuccess={(newCaseId) => navigate('client-case-detail', newCaseId)}
          />
        );

      case 'summary':
        return (
          <SummaryPage
            caseId={selectedCaseId}
            onBack={() => navigate(user.role === 'lawyer' ? 'case-detail' : 'client-case-detail', selectedCaseId)}
          />
        );

      default:
        return user.role === 'lawyer'
          ? <LawyerDashboard onNavigate={navigate} />
          : <ClientDashboard onNavigate={navigate} />;
    }
  }

  return (
    <div className="flex h-screen bg-stone-50 overflow-hidden">
      <Sidebar
        user={user}
        currentView={currentView}
        onNavigate={navigate}
        onLogout={logout}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar user={user} onLogout={logout} />
        <main className="flex-1 overflow-y-auto">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}