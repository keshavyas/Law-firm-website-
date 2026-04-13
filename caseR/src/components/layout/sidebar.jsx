export default function Sidebar({ user, currentView, onNavigate, onLogout }) {

  const lawyerLinks = [
    { view: 'dashboard', label: 'Dashboard',   icon: '⊞' },
    { view: 'cases',     label: 'All Cases',   icon: '⚖️' },
  ];

  const clientLinks = [
    { view: 'dashboard',     label: 'Dashboard',     icon: '⊞' },
    { view: 'cases',         label: 'My Cases',      icon: '⚖️' },
    { view: 'file-complaint', label: 'File Complaint', icon: '+' },
  ];

  const links = user?.role === 'lawyer' ? lawyerLinks : clientLinks;

  return (
    <div className="w-56 bg-stone-900 text-stone-100 flex flex-col h-full">

      {/* Logo */}
      <div className="px-5 py-5 border-b border-stone-700">
        <p className="text-lg font-serif font-medium">⚖️ LegalCase</p>
        <p className="text-xs text-stone-400 mt-0.5 capitalize">{user?.role} Portal</p>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {links.map(link => (
          <button
            key={link.view}
            onClick={() => onNavigate(link.view)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-left transition-colors ${
              currentView === link.view
                ? 'bg-stone-700 text-white'
                : 'text-stone-400 hover:bg-stone-800 hover:text-stone-100'
            }`}
          >
            <span className="text-base">{link.icon}</span>
            {link.label}
          </button>
        ))}
      </nav>

      {/* User + Logout */}
      <div className="px-3 py-4 border-t border-stone-700">
        <div className="flex items-center gap-2 px-3 py-2 mb-2">
          <div className="w-7 h-7 rounded-full bg-stone-600 flex items-center justify-center text-xs font-medium">
            {user?.initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-stone-200 truncate">{user?.name}</p>
            <p className="text-xs text-stone-500 truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="w-full text-xs text-stone-500 hover:text-stone-300 text-left px-3 py-1.5"
        >
          Sign out →
        </button>
      </div>
    </div>
  );
}