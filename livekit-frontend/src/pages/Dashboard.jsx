import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LiveKitRoom, VideoConference } from '@livekit/components-react';
import '@livekit/components-styles';
import { useAuth } from '../contexts/AuthContext';
import { authApi } from '../lib/api';
import '../styles/dashboard.css';

const Dashboard = () => {
  const { user, logout, refreshProfile } = useAuth();
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
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileForm, setProfileForm] = useState({ name: '', login: '', email: '' });
  const [error, setError] = useState('');
  const avatarInputRef = useRef(null);

  useEffect(() => {
    if (roomParam) setRoomCodeInput(roomParam);
  }, [roomParam]);

  useEffect(() => {
    if (!user) return;
    setProfileForm({
      name: user?.name || '',
      login: user?.login || '',
      email: user?.email || '',
    });
  }, [user]);

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

  const handleAvatarUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');
    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      await authApi.updateProfile(formData);
      await refreshProfile();
    } catch (err) {
      setError(err?.response?.data?.message || 'Не удалось загрузить аватар.');
    } finally {
      setUploadingAvatar(false);
      event.target.value = '';
    }
  };

  const openProfile = () => {
    if (user) {
      setProfileForm({
        name: user?.name || '',
        login: user?.login || '',
        email: user?.email || '',
      });
    }
    setProfileError('');
    setProfileSuccess('');
    setProfileOpen(true);
  };

  const handleProfileChange = (event) => {
    const { name, value } = event.target;
    setProfileForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleProfileSave = async (event) => {
    event.preventDefault();
    setProfileSaving(true);
    setProfileError('');
    setProfileSuccess('');
    try {
      await authApi.updateProfile(profileForm);
      await refreshProfile();
      setProfileSuccess('Профиль обновлен');
    } catch (err) {
      setProfileError(err?.response?.data?.message || 'Не удалось сохранить профиль.');
    } finally {
      setProfileSaving(false);
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
            <>
              <div className="profile-chip">
                {user?.avatar_url ? (
                  <img src={user.avatar_url} alt="Аватар" className="profile-chip__avatar" />
                ) : (
                  <span className="profile-chip__fallback">
                    {(user?.name || user?.login || 'U').slice(0, 1).toUpperCase()}
                  </span>
                )}
              </div>
              <button className="secondary-btn" onClick={openProfile}>Профиль</button>
              <button className="secondary-btn" onClick={logout}>Выйти</button>
            </>
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

      {profileOpen && (
        <div className="profile-modal-backdrop" onClick={() => setProfileOpen(false)}>
          <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
            <div className="profile-modal__header">
              <h2>Профиль</h2>
              <button type="button" className="ghost" onClick={() => setProfileOpen(false)}>Закрыть</button>
            </div>
            <div className="profile-modal__avatar-block">
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="Аватар" className="profile-modal__avatar" />
              ) : (
                <span className="profile-modal__avatar profile-modal__avatar--fallback">
                  {(user?.name || user?.login || 'U').slice(0, 1).toUpperCase()}
                </span>
              )}
              <button
                type="button"
                className="secondary-btn profile-chip__upload"
                onClick={() => avatarInputRef.current?.click()}
                disabled={uploadingAvatar}
              >
                {uploadingAvatar ? 'Загружаем…' : 'Сменить аватар'}
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                hidden
                onChange={handleAvatarUpload}
              />
            </div>
            <form className="profile-modal__form" onSubmit={handleProfileSave}>
              <label>
                <span>Имя</span>
                <input name="name" value={profileForm.name} onChange={handleProfileChange} />
              </label>
              <label>
                <span>Логин</span>
                <input name="login" value={profileForm.login} onChange={handleProfileChange} />
              </label>
              <label>
                <span>Email</span>
                <input name="email" type="email" value={profileForm.email} onChange={handleProfileChange} />
              </label>
              {profileError && <div className="form-error">{profileError}</div>}
              {profileSuccess && <div className="profile-success">{profileSuccess}</div>}
              <button type="submit" className="primary-btn" disabled={profileSaving}>
                {profileSaving ? 'Сохраняем…' : 'Сохранить'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
