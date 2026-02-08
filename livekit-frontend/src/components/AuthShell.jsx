import { Link } from 'react-router-dom';
import '../styles/auth.css';

const AuthShell = ({ title, subtitle, children, footer }) => {
  return (
    <div className="auth-shell">
      <div className="auth-shell__hero">
        <div className="auth-shell__brand">
          <span className="auth-shell__brand-mark">ZV</span>
          <span className="auth-shell__brand-text">vZvonke</span>
        </div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
        <div className="auth-shell__links">
          <Link to="/">Главная</Link>
          <Link to="/login">Вход</Link>
          <Link to="/register">Регистрация</Link>
        </div>
      </div>
      <div className="auth-shell__panel">
        <div className="auth-shell__panel-inner">
          {children}
          {footer && <div className="auth-shell__footer">{footer}</div>}
        </div>
      </div>
    </div>
  );
};

export default AuthShell;
