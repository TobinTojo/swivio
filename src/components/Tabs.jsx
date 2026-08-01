export default function Tabs({ tabs, active, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          className={`tabs__btn ${active === tab.id ? 'tabs__btn--active' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
          {tab.badge != null && <span className="tabs__badge">{tab.badge}</span>}
        </button>
      ))}
    </div>
  );
}
