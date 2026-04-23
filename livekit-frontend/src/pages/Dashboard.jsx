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
  const [sharebarOpen, setSharebarOpen] = useState(false);
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
    } catch {
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
    } catch {
      setError('Не удалось подключиться. Проверьте код комнаты.');
    } finally {
      setLoadingJoin(false);
    }
  };

  if (token) {
    return (
      <div className="room-container">
        {shareLink && (
          <div className={`room-sharebar ${sharebarOpen ? 'is-open' : ''}`}>
            <button
              type="button"
              className="room-sharebar__toggle"
              onClick={() => setSharebarOpen((prev) => !prev)}
              aria-expanded={sharebarOpen}
              aria-label={sharebarOpen ? 'Свернуть ссылку приглашения' : 'Показать ссылку приглашения'}
            >
              <span className="room-sharebar__chevron" aria-hidden>▾</span>
            </button>
            <div className="room-sharebar__panel">
              <div className="room-sharebar__actions">
                <input readOnly value={shareLink} />
                <button type="button" className="ghost" onClick={handleCopy}>
                  {copyStatus || 'Копировать'}
                </button>
              </div>
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
    <div className="landing">
      <header className="landing__header">
        <div className="landing__brand">
          <span className="landing__brand-mark">V</span>
          <span>вZвонке</span>
        </div>
        <div className="landing__header-actions">
          {user ? (
            <button className="secondary-btn" onClick={logout}>Выйти</button>
          ) : null}
        </div>
      </header>

      <main className="landing__content">
        <section className="landing__left">
          <h1>Видеовстречи без ограничений</h1>
          <p className="muted">
            Бесплатные звонки любого масштаба. Общайтесь с коллегами и друзьями без лимитов по времени.
          </p>

          <div className="meeting-panel">
            <div className="meeting-panel__row">
              {!user && (
                <label>
                  <span>Имя</span>
                  <input
                    placeholder="Ваше имя"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                  />
                </label>
              )}
              <label>
                <span>Название встречи</span>
                <input
                  placeholder="Например: Диплом, созвон"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                />
              </label>
            </div>
            <button
              className="primary-btn"
              onClick={handleCreate}
              disabled={!roomName || (!user && !userName) || loadingCreate}
            >
              {loadingCreate ? 'Подключаем…' : 'Создать встречу'}
            </button>
          </div>

          <div className="join-panel">
            <div className="join-panel__row">
              {!user && (
                <label>
                  <span>Имя</span>
                  <input
                    placeholder="Ваше имя"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                  />
                </label>
              )}
              <label>
                <span>Код или ссылка</span>
                <input
                  placeholder="https://.../guest?room=..."
                  value={roomCodeInput}
                  onChange={(e) => setRoomCodeInput(e.target.value)}
                />
              </label>
            </div>
            <button className="secondary-btn" onClick={handleJoin} disabled={(!user && !userName) || loadingJoin}>
              {loadingJoin ? 'Подключаем…' : 'Присоединиться'}
            </button>
          </div>

          {error && <div className="form-error">{error}</div>}

          {shareLink && (
            <div className="share-block">
              <span>Ссылка для приглашения</span>
              <div className="share-block__actions">
                <input readOnly value={shareLink} />
                <button type="button" className="secondary-btn" onClick={handleCopy}>
                  {copyStatus || 'Копировать'}
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="landing__preview" aria-hidden>
          <div className="preview-grid">
            <div className="preview-tile" />
            <div className="preview-tile preview-tile--active" />
            <div className="preview-tile" />
            <div className="preview-tile preview-tile--avatar">V</div>
            <div className="preview-controls">
              <span />
              <span />
              <span />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Dashboard;
