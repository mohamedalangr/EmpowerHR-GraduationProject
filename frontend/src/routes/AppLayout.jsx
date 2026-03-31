import { Outlet } from 'react-router-dom';
import { Navbar } from '../components/shared/Navbar';

export function AppLayout() {
  return (
    <>
      <Navbar />
      <main>
        <Outlet />
      </main>
    </>
  );
}
