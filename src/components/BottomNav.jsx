import React from 'react';
import { Menu } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getNavItems } from '../utils/navConfig';

const MAX_TABS = 4;

export const BottomNav = ({ activePage, setActivePage, onOpenMenu }) => {
  const { activeRole } = useApp();
  const tabs = getNavItems(activeRole).slice(0, MAX_TABS);

  return (
    <nav className="bottom-nav" aria-label="Navigation principale">
      {tabs.map((item) => {
        const Icon = item.icon;
        const isActive = activePage === item.id;
        return (
          <button
            key={item.id}
            type="button"
            className={`bottom-nav-tab ${isActive ? 'bottom-nav-tab-active' : ''}`}
            onClick={() => setActivePage(item.id)}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon className="bottom-nav-icon" />
            <span className="bottom-nav-label">{item.shortLabel}</span>
          </button>
        );
      })}
      <button type="button" className="bottom-nav-tab" onClick={onOpenMenu}>
        <Menu className="bottom-nav-icon" />
        <span className="bottom-nav-label">Menu</span>
      </button>
    </nav>
  );
};
