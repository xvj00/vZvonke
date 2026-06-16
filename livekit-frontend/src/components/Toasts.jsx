import { useEffect, useRef, useState } from 'react';
import '../styles/toasts.css';

let _addToast = null;

/**
 * Глобальный вызов: toast('Текст', 'error' | 'success' | 'info' | 'warning')
 * Работает из любого места без пропсов.
 */
export function toast(message, type = 'info', duration = 4500) {
  if (_addToast) _addToast(message, type, duration);
}

export function ToastProvider() {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  useEffect(() => {
    _addToast = (message, type, duration) => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev, { id, message, type, duration }]);
    };
    return () => { _addToast = null; };
  }, []);

  const remove = (id) => setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <div className="toast-container" aria-live="polite" aria-atomic="false">
      {toasts.map((t) => (
        <ToastItem key={t.id} {...t} onDismiss={() => remove(t.id)} />
      ))}
    </div>
  );
}

function ToastItem({ id, message, type, duration, onDismiss }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // trigger enter animation
    const enter = requestAnimationFrame(() => setVisible(true));
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 280);
    }, duration);
    return () => {
      cancelAnimationFrame(enter);
      clearTimeout(timer);
    };
  }, [duration, onDismiss]);

  return (
    <div className={`toast toast--${type} ${visible ? 'toast--visible' : ''}`} role="status">
      <span className="toast__icon" aria-hidden>
        <ToastIcon type={type} />
      </span>
      <span className="toast__message">{message}</span>
      <button type="button" className="toast__close" onClick={() => { setVisible(false); setTimeout(onDismiss, 280); }} aria-label="Закрыть">
        ×
      </button>
    </div>
  );
}

const ToastIcon = ({ type }) => {
  if (type === 'success') return (
    <svg viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
  );
  if (type === 'error') return (
    <svg viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
  );
  if (type === 'warning') return (
    <svg viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
    </svg>
  );
  // info
  return (
    <svg viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
    </svg>
  );
};
