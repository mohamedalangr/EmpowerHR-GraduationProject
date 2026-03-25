import { Btn } from './index.jsx';

export function Navbar({ role, activePage, onNavigate, onSwitchRole }) {
  const hrPages = [
    { id: 'forms',       label: 'Forms' },
    { id: 'submissions', label: 'Submissions' },
    { id: 'dashboard',   label: 'Dashboard' },
  ];
  const employeePages = [
    { id: 'careers',  label: 'Careers' },
    { id: 'feedback', label: 'Feedback' },
  ];
  const pages = role === 'hr' ? hrPages : employeePages;

  return (
    <nav style={{
      background: 'var(--white)',
      borderBottom: '1px solid #EAECF0',
      position: 'sticky', top: 0, zIndex: 100,
      padding: '0 32px',
    }}>
      <div style={{
        maxWidth: 1280, margin: '0 auto', height: 68,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 42, height: 42, background: 'var(--red)',
            borderRadius: 14, display: 'flex', alignItems: 'center',
            justifyContent: 'center', boxShadow: 'var(--shadow-red)',
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </div>
          <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-.3px' }}>
            HR Manager
          </span>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '3px 10px',
            background: role === 'hr' ? 'var(--accent-light)' : 'var(--red-light)',
            color: role === 'hr' ? '#8B4A42' : 'var(--red)',
            borderRadius: 20, marginLeft: 4,
          }}>
            {role === 'hr' ? 'HR Manager' : 'Employee'}
          </span>
        </div>

        {/* Nav tabs */}
        <div style={{ display: 'flex', gap: 4 }}>
          {pages.map(p => (
            <button key={p.id} onClick={() => onNavigate(p.id)} style={{
              padding: '8px 16px', fontSize: 13, fontWeight: 600,
              border: 'none', borderRadius: 20, cursor: 'pointer',
              background: activePage === p.id ? 'var(--red-light)' : 'none',
              color: activePage === p.id ? 'var(--red)' : 'var(--gray-500)',
              transition: 'all .15s',
            }}>
              {p.label}
            </button>
          ))}
        </div>

        {/* Role switcher (dev only) */}
        <Btn variant="ghost" size="sm" onClick={onSwitchRole}>
          Switch to {role === 'hr' ? 'Employee' : 'HR Manager'}
        </Btn>
      </div>
    </nav>
  );
}
