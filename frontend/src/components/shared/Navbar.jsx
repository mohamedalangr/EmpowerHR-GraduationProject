import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Btn } from './index.jsx';

const NAV_LINKS = {
  TeamMember: [
    { path: '/employee/feedback', label: 'Feedback' },
    { path: '/employee/profile',  label: 'Profile'  },
  ],
  TeamLeader: [
    { path: '/employee/feedback', label: 'Feedback' },
    { path: '/leader/team',       label: 'My Team'  },
    { path: '/employee/profile',  label: 'Profile'  },
  ],
  HRManager: [
    { path: '/hr/dashboard',   label: 'Dashboard'   },
    { path: '/hr/forms',       label: 'Forms'       },
    { path: '/hr/submissions', label: 'Submissions' },
    { path: '/hr/jobs',        label: 'Job Postings' },
    { path: '/hr/cv-ranking',  label: 'CV Ranking'  },
    { path: '/employee/profile', label: 'Profile'   },
  ],
  Admin: [
    { path: '/admin/dashboard', label: 'Dashboard' },
    { path: '/admin/users',     label: 'Users'     },
    { path: '/employee/profile', label: 'Profile'  },
  ],
  Candidate: [
    { path: '/candidate/dashboard',    label: 'Jobs'         },
    { path: '/candidate/applications', label: 'Applications' },
  ],
};

export function Navbar() {
  const { user, logout } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();

  if (!user) return null;

  const links = NAV_LINKS[user.role] ?? [];
  const activePath = location.pathname;

  const roleLabel = {
    TeamMember:  'Employee',
    TeamLeader:  'Team Leader',
    HRManager:   'HR Manager',
    Admin:       'Admin',
    Candidate:   'Candidate',
  }[user.role] ?? user.role;

  const isHR = ['HRManager', 'Admin'].includes(user.role);

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
            {isHR ? 'HR Manager' : 'HR Portal'}
          </span>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '3px 10px',
            background: isHR ? 'var(--accent-light)' : 'var(--red-light)',
            color: isHR ? '#8B4A42' : 'var(--red)',
            borderRadius: 20, marginLeft: 4,
          }}>
            {roleLabel}
          </span>
        </div>

        {/* Nav tabs */}
        <div style={{ display: 'flex', gap: 4 }}>
          {links.map(link => (
            <button
              key={link.path}
              onClick={() => navigate(link.path)}
              style={{
                padding: '8px 16px', fontSize: 13, fontWeight: 600,
                border: 'none', borderRadius: 20, cursor: 'pointer',
                background: activePath === link.path ? 'var(--red-light)' : 'none',
                color: activePath === link.path ? 'var(--red)' : 'var(--gray-500)',
                transition: 'all .15s',
              }}
            >
              {link.label}
            </button>
          ))}
        </div>

        {/* User info + logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, color: 'var(--gray-500)', fontWeight: 500 }}>
            {user.full_name}
          </span>
          <Btn variant="ghost" size="sm" onClick={logout}>
            Sign Out
          </Btn>
        </div>

      </div>
    </nav>
  );
}
