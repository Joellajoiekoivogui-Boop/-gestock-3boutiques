import React from 'react';

export const StatCard = ({ title, value, subtext, icon: Icon, color = 'indigo', trend }) => {
  return (
    <div className={`stat-card stat-card-${color}`}>
      <div className="stat-card-header">
        <span className="stat-card-title">{title}</span>
        <div className={`stat-card-icon-wrap icon-bg-${color}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="stat-card-body">
        <span className="stat-card-value">{value}</span>
        {subtext && <span className="stat-card-subtext">{subtext}</span>}
      </div>
      {trend && (
        <div className="stat-card-footer">
          <span className={`stat-trend ${trend.positive ? 'trend-up' : 'trend-down'}`}>
            {trend.positive ? '↑' : '↓'} {trend.value}
          </span>
          <span className="stat-trend-label">{trend.label}</span>
        </div>
      )}
    </div>
  );
};
