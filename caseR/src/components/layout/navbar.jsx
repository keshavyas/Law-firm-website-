export default function Navbar({ user , onLogout }) {
  return (
    <div className="h-14 bg-white border-b border-stone-200 flex items-center justify-between px-6">

      <div className="text-sm text-stone-500">
        {new Date().toLocaleDateString('en-IN', {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        })}
      </div>

      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="text-sm font-medium text-stone-800">{user?.name}</p>
          <p className="text-xs text-stone-400 capitalize">{user?.role}</p>
        </div>
        <div className="w-8 h-8 rounded-full bg-stone-800 flex items-center justify-center text-white text-xs font-medium">
          {user?.initials}
        </div>
      </div>
    </div>
  );
}
