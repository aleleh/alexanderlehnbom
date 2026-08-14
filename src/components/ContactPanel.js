import React, { useEffect, useState } from 'react';
import { db } from '../firebaseConfig';
import { collection, addDoc } from 'firebase/firestore';

const ContactPanel = ({ open, onClose }) => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('idle');

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !message.trim()) return;
    setStatus('sending');
    try {
      await addDoc(collection(db, 'messages'), {
        email,
        message,
        createdAt: new Date(),
      });
      setStatus('sent');
      setEmail('');
      setMessage('');
    } catch (err) {
      console.error('Failed to send message', err);
      setStatus('error');
    }
  };

  if (!open) return null;

  return (
    <div className="panel-backdrop" onClick={onClose}>
      <div
        className="panel"
        role="dialog"
        aria-modal="true"
        aria-label="Contact"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="panel-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <h2 className="panel-title">say hi</h2>

        {status === 'sent' ? (
          <p className="panel-sent">got it — I&apos;ll get back to you.</p>
        ) : (
          <form onSubmit={handleSubmit}>
            <label className="panel-label" htmlFor="cp-email">email</label>
            <input
              id="cp-email"
              type="email"
              className="panel-input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <label className="panel-label" htmlFor="cp-message">message</label>
            <textarea
              id="cp-message"
              className="panel-input"
              rows={4}
              placeholder="say something"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
            />

            <button type="submit" className="panel-submit" disabled={status === 'sending'}>
              {status === 'sending' ? 'sending…' : 'send'}
            </button>
            {status === 'error' && <p className="panel-error">that didn&apos;t send. try again?</p>}
          </form>
        )}
      </div>
    </div>
  );
};

export default ContactPanel;
