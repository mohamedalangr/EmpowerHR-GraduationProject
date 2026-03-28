import { useState } from 'react';
import { Navbar }              from './components/shared/Navbar.jsx';
import { ToastContainer }      from './components/shared/index.jsx';
import { HRFormsPage }         from './pages/hr/FormsPage.jsx';
import { HRSubmissionsPage }   from './pages/hr/SubmissionsPage.jsx';
import { HRDashboardPage }     from './pages/hr/DashboardPage.jsx';
import { HRJobsPage }          from './pages/hr/JobsPage.jsx';
import { HRCVRankingPage }     from './pages/hr/CVRankingPage.jsx';
import { EmployeeCareersPage } from './pages/employee/CareersPage.jsx';
import { EmployeeFeedbackPage } from './pages/employee/FeedbackPage.jsx';
import './index.css';

export default function App() {
  const [role, setRole]         = useState('employee'); // 'employee' | 'hr'
  const [activePage, setPage]   = useState('feedback');

  const switchRole = () => {
    const next = role === 'hr' ? 'employee' : 'hr';
    setRole(next);
    setPage(next === 'hr' ? 'forms' : 'feedback');
  };

  const renderPage = () => {
    if (role === 'hr') {
      if (activePage === 'jobs')       return <HRJobsPage />;
      if (activePage === 'forms')       return <HRFormsPage />;
      if (activePage === 'submissions') return <HRSubmissionsPage />;
      if (activePage === 'dashboard')   return <HRDashboardPage />;
      if (activePage === 'cv-ranking')  return <HRCVRankingPage />;
    } else {
      if (activePage === 'careers')  return <EmployeeCareersPage />;
      if (activePage === 'feedback') return <EmployeeFeedbackPage />;
    }
    return null;
  };

  return (
    <>
      <Navbar
        role={role}
        activePage={activePage}
        onNavigate={setPage}
        onSwitchRole={switchRole}
      />
      <main>{renderPage()}</main>
      <ToastContainer />
    </>
  );
}
