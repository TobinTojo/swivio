function UserAvatar({ user, className = '' }) {
  const initial = user.displayName?.charAt(0)?.toUpperCase() || '?';

  if (user.avatarUrl) {
    return (
      <img
        className={`people-list__avatar-img ${className}`.trim()}
        src={user.avatarUrl}
        alt=""
      />
    );
  }

  return (
    <span className={`people-list__avatar ${className}`.trim()}>{initial}</span>
  );
}

export default function PeopleList({
  users,
  hostUserId,
  currentUserId,
  showReady = false,
}) {
  return (
    <ul className="people-list">
      {users.map((user) => {
        const isHost = user.id === hostUserId;
        const isSelf = user.id === currentUserId;
        return (
          <li key={user.id} className={`people-list__item ${isSelf ? 'people-list__item--self' : ''}`}>
            <UserAvatar user={user} />
            <span className="people-list__name">{user.displayName}</span>
            {showReady && (
              <span className={`people-list__ready ${user.isReady ? 'people-list__ready--yes' : ''}`}>
                {user.isReady ? '✓ Ready' : 'Not ready'}
              </span>
            )}
            {isHost && <span className="badge badge--host">Host</span>}
            {isSelf && <span className="badge badge--you">You</span>}
          </li>
        );
      })}
    </ul>
  );
}
