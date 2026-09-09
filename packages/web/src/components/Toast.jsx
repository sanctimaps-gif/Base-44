import { useEffect, useState } from 'react';
import Icon from './Icon.jsx';

export function useToast() {
  const [message, setMessage] = useState('');
  const [type, setType] = useState('success');

  const show = (msg, msgType = 'success') => {
    setMessage(msg);
    setType(msgType);
    setTimeout(() => setMessage(''), 2600);
  };

  return { show, message, type };
}

export function Toast({ message, type = 'success' }) {
  if (!message) return null;

  const bgColor = {
    success: 'var(--success)',
    error: 'var(--danger)',
    info: 'var(--accent)',
  }[type] || 'var(--success)';

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        background: bgColor,
        color: 'white',
        padding: '12px 16px',
        borderRadius: 'var(--radius)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        zIndex: 1000,
        boxShadow: 'var(--shadow)',
        animation: 'slideIn 0.2s ease',
      }}
    >
      <Icon name={type === 'error' ? 'alert-circle' : 'check-circle'} size={16} />
      {message}
    </div>
  );
}
