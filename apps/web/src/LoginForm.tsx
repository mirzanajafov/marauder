import { useState } from 'react';
import { errorMessage } from './api';

export function LoginForm({ onLogin }: { onLogin: (password: string) => Promise<void> }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (): Promise<void> => {
    setBusy(true);
    try {
      await onLogin(password);
      setPassword('');
      setError(null);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="auth"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      {error && <span className="auth-error">{error}</span>}
      <input
        type="password"
        className={error ? 'error' : ''}
        value={password}
        onChange={(event) => {
          setPassword(event.target.value);
          setError(null);
        }}
        placeholder="admin password"
        aria-label="admin password"
        aria-invalid={error !== null}
      />
      <button type="submit" disabled={busy || password.trim() === ''}>
        login
      </button>
    </form>
  );
}
