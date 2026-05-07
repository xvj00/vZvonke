import { lazy, Suspense, useEffect, useMemo } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import RequireAdmin from './components/RequireAdmin';
import './styles/app.css';

const Admin = lazy(() => import('./pages/Admin'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));

function App() {
  const location = useLocation();

  const seoData = useMemo(() => {
    const pathname = location.pathname || '/';
    const roomFromQuery = new URLSearchParams(location.search).get('room');
    const joinMatch = pathname.match(/^\/join\/([^/]+)/);
    const room = roomFromQuery || (joinMatch ? decodeURIComponent(joinMatch[1]) : '');

    if (pathname.startsWith('/login')) {
      return {
        title: 'Вход - вZvonke',
        description: 'Вход в сервис видеоконференций вZvonke.',
      };
    }

    if (pathname.startsWith('/admin')) {
      return {
        title: 'Админка - вZvonke',
        description: 'Панель администратора вZvonke для просмотра пользователей и комнат.',
      };
    }

    if (pathname.startsWith('/register')) {
      return {
        title: 'Регистрация - вZvonke',
        description: 'Создание аккаунта для доступа к видеокомнатам вZvonke.',
      };
    }

    if ((pathname.startsWith('/guest') || pathname.startsWith('/join/')) && room) {
      return {
        title: `Комната ${room} - вZvonke`,
        description: `Подключение к видеокомнате ${room} в сервисе вZvonke.`,
      };
    }

    return {
      title: 'вZvonke - защищенные видеоконференции',
      description:
        'Создавайте видеовстречи и подключайтесь к комнатам за несколько секунд в защищенном отечественном сервисе.',
    };
  }, [location.pathname, location.search]);

  useEffect(() => {
    document.title = seoData.title;

    const descriptionTag = document.querySelector('meta[name="description"]');
    if (descriptionTag) {
      descriptionTag.setAttribute('content', seoData.description);
    }

    const canonicalTag = document.querySelector('link[rel="canonical"]');
    if (canonicalTag) {
      canonicalTag.setAttribute('href', window.location.href.split('?')[0]);
    }
  }, [seoData]);

  return (
    <Suspense
      fallback={
        <div className="app-loading" aria-label="Loading">
          <div className="spinner" />
        </div>
      }
    >
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <Admin />
            </RequireAdmin>
          }
        />
        <Route path="/guest" element={<Dashboard />} />
        <Route path="/join/:roomId" element={<Dashboard />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default App;
