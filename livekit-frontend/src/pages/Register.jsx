import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthShell from '../components/AuthShell';
import { useAuth } from '../contexts/AuthContext';
import { extractFieldErrors, isValidationError } from '../lib/api';

const Register = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ login: '', name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

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
      await register(form);
      navigate('/', { replace: true });
    } catch (err) {
      if (isValidationError(err)) {
        const errors = extractFieldErrors(err);
        setFieldErrors(errors);
        const fallback = err?.response?.data?.error || 'Проверьте поля регистрации.';
        setError(Object.keys(errors).length ? '' : fallback);
      } else {
        setError(err?.response?.data?.error || 'Регистрация не удалась. Сервер не отвечает.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Создайте аккаунт"
      subtitle="Пару минут — и вы можете подключаться к учебным комнатам и проектным созвонам."
      footer={
        <span>
          Уже есть аккаунт? <Link to="/login">Войти</Link>
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
          Имя
          <input
            name="name"
            type="text"
            placeholder="Анна Ильина"
            value={form.name}
            onChange={onChange}
            required
          />
          {fieldErrors.name && <span className="field-error">{fieldErrors.name}</span>}
        </label>
        <label>
          Почта
          <input
            name="email"
            type="email"
            placeholder="anna@campus.ru"
            value={form.email}
            onChange={onChange}
            required
          />
          {fieldErrors.email && <span className="field-error">{fieldErrors.email}</span>}
        </label>
        <label>
          Пароль
          <input
            name="password"
            type="password"
            placeholder="минимум 6 символов"
            value={form.password}
            onChange={onChange}
            required
          />
          {fieldErrors.password && <span className="field-error">{fieldErrors.password}</span>}
        </label>
        {error && <div className="form-error">{error}</div>}
        <button type="submit" disabled={loading}>
          {loading ? 'Создаём…' : 'Зарегистрироваться'}
        </button>
      </form>
    </AuthShell>
  );
};

export default Register;
