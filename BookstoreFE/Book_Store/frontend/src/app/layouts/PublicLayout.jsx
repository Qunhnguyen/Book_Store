import { Outlet } from 'react-router-dom';

export default function PublicLayout() {
  return (
    <div className="public-shell">
      <Outlet />
    </div>
  );
}
