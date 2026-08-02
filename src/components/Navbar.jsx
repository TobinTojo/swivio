import { Link } from 'react-router-dom';
import { IconFilm, IconShare, IconArrowLeft } from './Icons.jsx';

export default function Navbar({
  variant = 'landing',
  roomId,
  tabs,
  activeTab,
  onTabChange,
  onShare,
  copied,
  avatarUrl,
  displayName,
  connected = true,
  statusPills,
  userChip,
}) {
  return (
    <nav className={`navbar navbar--${variant}`}>
      <div className="navbar__left">
        {variant === 'room' ? (
          <Link to="/" className="navbar__back" aria-label="Back home">
            <IconArrowLeft />
          </Link>
        ) : null}
        <Link to="/" className="navbar__brand">
          <IconFilm className="navbar__logo-icon" />
          <span>Swivio</span>
        </Link>
        {variant === 'room' && roomId && (
          <div className="navbar__room">
            <span className="navbar__room-label">Room</span>
            <strong>{roomId}</strong>
            {!connected && <span className="badge badge--warn">Offline</span>}
          </div>
        )}
      </div>

      {variant === 'room' && tabs?.length > 0 && (
        <div className="navbar__tabs" role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`navbar__tab ${activeTab === tab.id ? 'navbar__tab--active' : ''}`}
              onClick={() => onTabChange?.(tab.id)}
            >
              {tab.label}
              {tab.badge != null && tab.badge > 0 && (
                <span className="navbar__tab-badge">{tab.badge}</span>
              )}
            </button>
          ))}
        </div>
      )}

      <div className="navbar__right">
        {statusPills}
        {variant === 'room' && onShare && (
          <button type="button" className="btn btn--ghost btn--sm navbar__share" onClick={onShare}>
            <IconShare className="navbar__share-icon" />
            {copied ? 'Copied!' : 'Share'}
          </button>
        )}
        {userChip}
        {!userChip && avatarUrl && (
          <img className="navbar__avatar" src={avatarUrl} alt="" title={displayName} />
        )}
      </div>
    </nav>
  );
}
