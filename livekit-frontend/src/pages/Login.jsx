import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AuthShell from '../components/AuthShell';
import { useAuth } from '../contexts/AuthContext';
import { extractFieldErrors, isValidationError } from '../lib/api';

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ login: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const from = useMemo(() => location.state?.from?.pathname || '/', [location.state]);

  const onChange = (event) => {
    setForm((prev) => ({ ...prev, [event.target.name]: event.target.value }));
    setFieldErrors((prev) => ({ ...prev, [event.target.name]: '' }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setFieldErrors({});
    try {
      await login(form);
      navigate(from, { replace: true });
    } catch (err) {
      if (isValidationError(err)) {
        const errors = extractFieldErrors(err);
        setFieldErrors(errors);
        const fallback = err?.response?.data?.error || 'Проверьте логин и пароль.';
        setError(errors?.login || errors?.password ? '' : fallback);
      } else {
        setError(err?.response?.data?.error || 'Не удалось войти. Сервер не отвечает.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="С возвращением"
      subtitle="Войдите, чтобы подключаться к комнатам LiveKit и сохранять историю встреч."
      footer={
        <span>
          Нет аккаунта? <Link to="/register">Создать</Link>
        </span>
      }
    >
      <form className="auth-form" onSubmit={onSubmit}>
        <label>
          Логин
          <input
            name="login"
            type="text"
            placeholder="student01"
            value={form.login}
            onChange={onChange}
            required
          />
          {fieldErrors.login && <span className="field-error">{fieldErrors.login}</span>}
        </label>
        <label>
          Пароль
          <input
            name="password"
            type="password"
            placeholder="••••••"
            value={form.password}
            onChange={onChange}
            required
          />
          {fieldErrors.password && <span className="field-error">{fieldErrors.password}</span>}
        </label>
        {error && <div className="form-error">{error}</div>}
        <button type="submit" disabled={loading}>
          {loading ? 'Входим…' : 'Войти'}
        </button>
      </form>
    </AuthShell>
  );
};

export default Login;
