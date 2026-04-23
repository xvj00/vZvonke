import { Link } from 'react-router-dom';
import '../styles/auth.css';

const AuthShell = ({ title, subtitle, children, footer }) => {
  return (
    <div className="auth-page">
      <header className="auth-page__header">
        <div className="auth-page__brand">
          <span className="auth-page__brand-mark">V</span>
          <span>вZвонке</span>
        </div>
      </header>

      <Link to="/" className="auth-page__back">
        Вернуться
      </Link>

      <div className="auth-card">
        <h1>{title}</h1>
        <p>{subtitle}</p>
        {children}
        {footer && <div className="auth-card__footer">{footer}</div>}
      </div>
    </div>
  );
};

export default AuthShell;
