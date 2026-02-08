import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LiveKitRoom, VideoConference } from '@livekit/components-react';
import '@livekit/components-styles';
import { useAuth } from '../contexts/AuthContext';
import { authApi } from '../lib/api';
import '../styles/dashboard.css';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const [searchParams] = useSearchParams();
  const roomParam = searchParams.get('room');

  const [userName, setUserName] = useState('');
  const [roomName, setRoomName] = useState('');
  const [roomCodeInput, setRoomCodeInput] = useState(roomParam || '');
  const [token, setToken] = useState(null);
  const [shareLink, setShareLink] = useState('');
  const [copyStatus, setCopyStatus] = useState('');
  const [loadingCreate, setLoadingCreate] = useState(false);
  const [loadingJoin, setLoadingJoin] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (roomParam) setRoomCodeInput(roomParam);
  }, [roomParam]);

  const buildShareLink = (roomUuid) => `${window.location.origin}/guest?room=${roomUuid}`;

  const extractRoomCode = (value) => {
    const trimmed = value.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      try {
        const url = new URL(trimmed);
        return url.searchParams.get('room') || '';
      } catch {
        return '';
      }
    }
    const match = trimmed.match(/room=([^&]+)/);
    if (match) return match[1];
    return trimmed;
  };

  const handleCopy = async () => {
    if (!shareLink) return;
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopyStatus('Скопировано');
    } catch {
      const input = document.createElement('textarea');
      input.value = shareLink;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopyStatus('Скопировано');
    } finally {
      setTimeout(() => setCopyStatus(''), 1500);
    }
  };

  const handleCreate = async () => {
    setLoadingCreate(true);
    setError('');
    try {
      const displayName = user ? (user?.name || user?.login || 'Пользователь') : (userName || 'Гость');

      const data = await authApi.getLivekitToken({
        room_name: roomName,
        user_name: displayName,
      });

      if (data?.token) {
        if (data?.room_uuid) {
          const link = buildShareLink(data.room_uuid);
          setShareLink(link);
          setRoomCodeInput(data.room_uuid);
        }
        setToken(data.token);
      } else {
        setError('Токен не получен. Проверьте API.');
      }
    } catch (err) {
      setError('Ошибка подключения к backend. Проверьте Laravel и CORS.');
    } finally {
      setLoadingCreate(false);
    }
  };

  const handleJoin = async () => {
    setLoadingJoin(true);
    setError('');
    try {
      const roomUuid = extractRoomCode(roomCodeInput);
      if (!roomUuid) {
        setError('Укажите ссылку или код комнаты.');
        return;
      }

      const displayName = user ? (user?.name || user?.login || 'Пользователь') : (userName || 'Гость');

      const data = await authApi.getLivekitToken({
        room_uuid: roomUuid,
        user_name: displayName,
      });

      if (data?.token) {
        setShareLink(buildShareLink(roomUuid));
        setRoomCodeInput(roomUuid);
        setToken(data.token);
      } else {
        setError('Токен не получен. Проверьте API.');
      }
    } catch (err) {
      setError('Не удалось подключиться. Проверьте код комнаты.');
    } finally {
      setLoadingJoin(false);
    }
  };

  if (token) {
    return (
      <div className="room-container">
        {shareLink && (
          <div className="room-sharebar">
            <span>Ссылка для приглашения</span>
            <div className="room-sharebar__actions">
              <input readOnly value={shareLink} />
              <button type="button" className="ghost" onClick={handleCopy}>
                {copyStatus || 'Копировать'}
              </button>
            </div>
          </div>
        )}
        <LiveKitRoom
          video={false}
          audio={false}
          token={token}
          serverUrl={import.meta.env.VITE_LIVEKIT_WS_URL || 'ws://localhost:7880'}
          onDisconnected={() => setToken(null)}
          data-lk-theme="default"
        >
          <VideoConference />
        </LiveKitRoom>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <header className="dashboard__header">
        <div>
          <p className="eyebrow">Закрытые видеовстречи</p>
          <h2>LiveKit Campus</h2>
          <p className="muted">Создайте комнату, поделитесь названием и подключайтесь за пару кликов.</p>
        </div>
        {user && <button className="ghost" onClick={logout}>Выйти</button>}
      </header>

      <section className="dashboard__grid">
        <div className="tile tile--primary">
          <div className="tile__icon">
            <span className="icon-bubble" />
          </div>
          <h3>Создать видеовстречу</h3>
          <p className="muted">Укажите название встречи — комната будет создана и доступна по имени.</p>
          <div className="form-grid">
            {!user && (
              <label>
                Имя
                <input
                  placeholder="Ваше имя"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                />
              </label>
            )}
            <label>
              Название
              <input
                placeholder="Например: Диплом, созвон"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
              />
            </label>
          </div>
          {error && <div className="form-error">{error}</div>}
          <button className="tile__cta" onClick={handleCreate} disabled={!roomName || (!user && !userName) || loadingCreate}>
            {loadingCreate ? 'Подключаем…' : 'Создать и войти'}
          </button>
        </div>
        <div className="tile tile--action">
          <div className="tile__icon tile__icon--small">
            <span className="icon-people" />
          </div>
          <h3>Присоединиться по ссылке</h3>
          <p className="muted">Вставьте ссылку или код комнаты и подключайтесь.</p>
          <div className="form-grid">
            {!user && (
              <label>
                Имя
                <input
                  placeholder="Ваше имя"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                />
              </label>
            )}
            <label>
              Ссылка или код
              <input
                placeholder="https://.../guest?room=..."
                value={roomCodeInput}
                onChange={(e) => setRoomCodeInput(e.target.value)}
              />
            </label>
          </div>
          <button className="tile__cta" onClick={handleJoin} disabled={(!user && !userName) || loadingJoin}>
            {loadingJoin ? 'Подключаем…' : 'Войти'}
          </button>
          {error && <div className="form-error">{error}</div>}
        </div>
        <div className="tile tile--action">
          <div className="tile__icon tile__icon--small">
            <span className="icon-calendar" />
          </div>
          <h3>Запланировать</h3>
          <p className="muted">Сохраните детали созвона в календаре после старта комнаты.</p>
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
