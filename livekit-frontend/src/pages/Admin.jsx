import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../lib/api';
import '../styles/admin.css';

const tabs = [
  { id: 'overview', label: 'Обзор' },
  { id: 'users', label: 'Пользователи' },
  { id: 'rooms', label: 'Комнаты' },
  { id: 'active', label: 'Активные' },
];

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getPageItems = (page) => page?.data || [];

const Admin = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [overview, setOverview] = useState(null);
  const [usersPage, setUsersPage] = useState(null);
  const [roomsPage, setRoomsPage] = useState(null);
  const [activeRoomsPage, setActiveRoomsPage] = useState(null);
  const [usersSearch, setUsersSearch] = useState('');
  const [roomsStatus, setRoomsStatus] = useState('');
  const [usersPageNumber, setUsersPageNumber] = useState(1);
  const [roomsPageNumber, setRoomsPageNumber] = useState(1);
  const [activeRoomsPageNumber, setActiveRoomsPageNumber] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadOverview = useCallback(async () => {
    const data = await adminApi.overview();
    setOverview(data);
  }, []);

  const loadUsers = useCallback(async () => {
    const data = await adminApi.users({
      page: usersPageNumber,
      search: usersSearch || undefined,
      per_page: 20,
    });
    setUsersPage(data);
  }, [usersPageNumber, usersSearch]);

  const loadRooms = useCallback(async () => {
    const data = await adminApi.rooms({
      page: roomsPageNumber,
      status: roomsStatus || undefined,
      per_page: 20,
    });
    setRoomsPage(data);
  }, [roomsPageNumber, roomsStatus]);

  const loadActiveRooms = useCallback(async () => {
    const data = await adminApi.activeRooms({
      page: activeRoomsPageNumber,
      per_page: 20,
    });
    setActiveRoomsPage(data);
  }, [activeRoomsPageNumber]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (activeTab === 'overview') await loadOverview();
      if (activeTab === 'users') await loadUsers();
      if (activeTab === 'rooms') await loadRooms();
      if (activeTab === 'active') await loadActiveRooms();
    } catch (err) {
      setError(err?.response?.data?.message || 'Не удалось загрузить данные админки.');
    } finally {
      setLoading(false);
    }
  }, [activeTab, loadActiveRooms, loadOverview, loadRooms, loadUsers]);

  useEffect(() => {
    const refreshTask = window.setTimeout(() => {
      void refresh();
    }, 0);

    return () => window.clearTimeout(refreshTask);
  }, [refresh]);

  const currentPage = useMemo(() => {
    if (activeTab === 'users') return usersPage;
    if (activeTab === 'rooms') return roomsPage;
    if (activeTab === 'active') return activeRoomsPage;
    return null;
  }, [activeRoomsPage, activeTab, roomsPage, usersPage]);

  const goPage = (direction) => {
    const update = (setter, page, lastPage) => {
      setter(Math.min(Math.max(page + direction, 1), lastPage || 1));
    };

    if (activeTab === 'users') update(setUsersPageNumber, usersPageNumber, usersPage?.last_page);
    if (activeTab === 'rooms') update(setRoomsPageNumber, roomsPageNumber, roomsPage?.last_page);
    if (activeTab === 'active') update(setActiveRoomsPageNumber, activeRoomsPageNumber, activeRoomsPage?.last_page);
  };

  return (
    <div className="admin-page">
      <header className="admin-topbar">
        <div>
          <div className="admin-brand">вZvonke</div>
          <h1>Админка</h1>
        </div>
        <div className="admin-topbar__actions">
          <button type="button" className="secondary-btn" onClick={refresh} disabled={loading}>
            Обновить
          </button>
          <Link className="secondary-btn" to="/">
            На главную
          </Link>
        </div>
      </header>

      <nav className="admin-tabs" aria-label="Разделы админки">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={activeTab === tab.id ? 'is-active' : ''}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {error && <div className="admin-alert">{error}</div>}

      {activeTab === 'overview' && (
        <section className="admin-section">
          <div className="admin-metrics">
            <Metric label="Пользователи" value={overview?.users_count} />
            <Metric label="Комнаты" value={overview?.rooms_count} />
            <Metric label="Активные комнаты" value={overview?.active_rooms_count} />
            <Metric label="Сейчас в комнатах" value={overview?.active_participants_count} />
          </div>

          <div className="admin-split">
            <LatestList title="Новые пользователи" items={overview?.latest_users || []} type="users" />
            <LatestList title="Последние комнаты" items={overview?.latest_rooms || []} type="rooms" />
          </div>
        </section>
      )}

      {activeTab === 'users' && (
        <section className="admin-section">
          <div className="admin-toolbar">
            <input
              value={usersSearch}
              onChange={(event) => {
                setUsersSearch(event.target.value);
                setUsersPageNumber(1);
              }}
              placeholder="Поиск по логину, имени или email"
            />
          </div>
          <UsersTable users={getPageItems(usersPage)} loading={loading} />
        </section>
      )}

      {activeTab === 'rooms' && (
        <section className="admin-section">
          <div className="admin-toolbar">
            <select
              value={roomsStatus}
              onChange={(event) => {
                setRoomsStatus(event.target.value);
                setRoomsPageNumber(1);
              }}
            >
              <option value="">Все статусы</option>
              <option value="active">Активные</option>
              <option value="closed">Закрытые</option>
            </select>
          </div>
          <RoomsTable rooms={getPageItems(roomsPage)} loading={loading} />
        </section>
      )}

      {activeTab === 'active' && (
        <section className="admin-section">
          <RoomsTable rooms={getPageItems(activeRoomsPage)} loading={loading} />
        </section>
      )}

      {currentPage && (
        <footer className="admin-pagination">
          <span>
            Страница {currentPage.current_page || 1} из {currentPage.last_page || 1}
          </span>
          <div>
            <button type="button" className="secondary-btn" onClick={() => goPage(-1)} disabled={!currentPage.prev_page_url}>
              Назад
            </button>
            <button type="button" className="secondary-btn" onClick={() => goPage(1)} disabled={!currentPage.next_page_url}>
              Вперёд
            </button>
          </div>
        </footer>
      )}
    </div>
  );
};

const Metric = ({ label, value }) => (
  <div className="admin-metric">
    <span>{label}</span>
    <strong>{value ?? '—'}</strong>
  </div>
);

const LatestList = ({ title, items, type }) => (
  <section className="admin-panel">
    <h2>{title}</h2>
    <div className="admin-list">
      {items.length === 0 ? (
        <div className="admin-empty">Пока пусто</div>
      ) : (
        items.map((item) => (
          <div className="admin-list__row" key={`${type}-${item.id}`}>
            <div>
              <strong>{type === 'users' ? item.name : item.title}</strong>
              <span>{type === 'users' ? item.email : item.uuid}</span>
            </div>
            <time>{formatDate(item.created_at)}</time>
          </div>
        ))
      )}
    </div>
  </section>
);

const UsersTable = ({ users, loading }) => (
  <div className="admin-table-wrap">
    <table className="admin-table">
      <thead>
        <tr>
          <th>ID</th>
          <th>Пользователь</th>
          <th>Email</th>
          <th>Роль</th>
          <th>Комнаты</th>
          <th>Участия</th>
          <th>Создан</th>
        </tr>
      </thead>
      <tbody>
        {loading ? (
          <EmptyRow colSpan={7} text="Загружаем…" />
        ) : users.length === 0 ? (
          <EmptyRow colSpan={7} text="Пользователей не найдено" />
        ) : (
          users.map((user) => (
            <tr key={user.id}>
              <td>{user.id}</td>
              <td>
                <strong>{user.name}</strong>
                <span>{user.login}</span>
              </td>
              <td>{user.email}</td>
              <td>
                <span className={`admin-badge ${user.role === 'admin' ? 'is-admin' : ''}`}>{user.role}</span>
              </td>
              <td>{user.owned_rooms_count ?? 0}</td>
              <td>{user.room_participations_count ?? 0}</td>
              <td>{formatDate(user.created_at)}</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  </div>
);

const RoomsTable = ({ rooms, loading }) => (
  <div className="admin-table-wrap">
    <table className="admin-table">
      <thead>
        <tr>
          <th>ID</th>
          <th>Комната</th>
          <th>Владелец</th>
          <th>Статус</th>
          <th>Участники</th>
          <th>Активны</th>
          <th>Сообщения</th>
          <th>Создана</th>
        </tr>
      </thead>
      <tbody>
        {loading ? (
          <EmptyRow colSpan={8} text="Загружаем…" />
        ) : rooms.length === 0 ? (
          <EmptyRow colSpan={8} text="Комнат не найдено" />
        ) : (
          rooms.map((room) => (
            <tr key={room.id}>
              <td>{room.id}</td>
              <td>
                <strong>{room.title}</strong>
                <span>{room.uuid}</span>
              </td>
              <td>
                <strong>{room.owner?.name || '—'}</strong>
                <span>{room.owner?.email || ''}</span>
              </td>
              <td>
                <span className={`admin-badge ${room.status === 'active' ? 'is-active' : ''}`}>{room.status === 'active' ? 'Активна' : 'Закрыта'}</span>
              </td>
              <td>{room.participants_count ?? 0}</td>
              <td>{room.active_participants_count ?? 0}</td>
              <td>{room.messages_count ?? 0}</td>
              <td>{formatDate(room.created_at)}</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  </div>
);

const EmptyRow = ({ colSpan, text }) => (
  <tr>
    <td className="admin-table__empty" colSpan={colSpan}>
      {text}
    </td>
  </tr>
);

export default Admin;
