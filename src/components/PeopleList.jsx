export default function PeopleList({ users, hostUserId, currentUserId }) {
  return (
    <ul className="people-list">
      {users.map((user) => {
        const isHost = user.id === hostUserId;
        const isSelf = user.id === currentUserId;
        return (
          <li key={user.id} className={`people-list__item ${isSelf ? 'people-list__item--self' : ''}`}>
            <span className="people-list__avatar">
              {user.displayName?.charAt(0)?.toUpperCase() || '?'}
            </span>
            <span className="people-list__name">{user.displayName}</span>
            {isHost && <span className="badge badge--host">Host</span>}
            {isSelf && <span className="badge badge--you">You</span>}
          </li>
        );
      })}
    </ul>
  );
}
