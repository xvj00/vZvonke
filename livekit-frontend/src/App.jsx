import { useEffect, useMemo } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import RequireAuth from './components/RequireAuth';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Register from './pages/Register';
import './styles/app.css';

function App() {
  const location = useLocation();

  const seoData = useMemo(() => {
    const pathname = location.pathname || '/';
    const room = new URLSearchParams(location.search).get('room');

    if (pathname.startsWith('/login')) {
      return {
        title: 'Вход - вZvonke',
        description: 'Вход в сервис видеоконференций вZvonke.',
      };
    }

    if (pathname.startsWith('/register')) {
      return {
        title: 'Регистрация - вZvonke',
        description: 'Создание аккаунта для доступа к видеокомнатам вZvonke.',
      };
    }

    if (pathname.startsWith('/guest') && room) {
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
    <Routes>
      <Route
        path="/"
        element={
          <RequireAuth>
            <Dashboard />
          </RequireAuth>
        }
      />
      <Route path="/guest" element={<Dashboard />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
