import { NavLink, Outlet } from 'react-router-dom';
import './layout.css';

const NAV = [
  { to: '/', label: 'Objekte', end: true },
  { to: '/input', label: 'Input' },
  { to: '/nebenkosten', label: 'Nebenkosten' },
  { to: '/steuerbericht', label: 'Steuerbericht' },
  { to: '/vermoegen', label: 'Vermögen' },
];

export default function Layout() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-title">
          <span className="app-title-eyebrow">Objektakten</span>
          <h1>Wohnungen Report</h1>
        </div>
        <nav className="tab-nav">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `tab-nav-item${isActive ? ' active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="app-content">
        <Outlet />
      </main>
    </div>
  );
}
