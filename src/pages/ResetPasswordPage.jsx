import { useEffect, useState } from 'react';
import { Eye, EyeOff, LockKeyhole } from 'lucide-react';
import { supabase } from '../utils/supabase';

const parseRecoveryParams = () => {
  const hash = window.location.hash.replace(/^#/, '');
  const search = window.location.search.replace(/^\?/, '');
  const params = new URLSearchParams(hash || search);
  return {
    accessToken: params.get('access_token') || '',
    refreshToken: params.get('refresh_token') || '',
    type: params.get('type') || '',
    error: params.get('error_description') || params.get('error') || '',
  };
};

const ResetPasswordPage = () => {
  const [recoveryParams] = useState(() => parseRecoveryParams());
  const [ready, setReady] = useState(false);
  const [sessionError, setSessionError] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const prepareSession = async () => {
      if (recoveryParams.error) {
        setSessionError(recoveryParams.error);
        return;
      }

      if (!recoveryParams.accessToken || !recoveryParams.refreshToken) {
        setSessionError('This reset link is invalid or expired. Please request a new password reset email.');
        return;
      }

      try {
        const { error: setSessionErrorResult } = await supabase.auth.setSession({
          access_token: recoveryParams.accessToken,
          refresh_token: recoveryParams.refreshToken,
        });
        if (setSessionErrorResult) throw setSessionErrorResult;
        window.history.replaceState({}, '', '/reset-password');
        setReady(true);
      } catch (e) {
        setSessionError(e.message || 'Unable to verify this reset link.');
      }
    };

    prepareSession();
  }, [recoveryParams]);

  const submitNewPassword = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');

    if (password.length < 8) {
      setError('Use at least 8 characters for your new password.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Both password fields must match.');
      return;
    }

    setBusy(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      await supabase.auth.signOut().catch(() => {});
      localStorage.removeItem('ph_user');
      setMessage('Your password has been updated. You can now log in with the new password.');
      setPassword('');
      setConfirmPassword('');
    } catch (e) {
      setError(e.message || 'Unable to update your password.');
    } finally {
      setBusy(false);
    }
  };

  const goToLogin = () => {
    window.history.replaceState({}, '', '/');
    window.location.reload();
  };

  return (
    <main style={{
      minHeight: '100vh',
      background: '#f7f5f1',
      display: 'grid',
      placeItems: 'center',
      padding: '32px',
      color: '#07111f',
      fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      <section style={{
        width: 'min(100%, 560px)',
        background: '#fff',
        border: '1px solid #ece7df',
        borderRadius: '26px',
        padding: '42px',
        boxShadow: '0 28px 80px rgba(15, 23, 42, 0.08)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '34px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '11px',
            background: 'linear-gradient(135deg, #6d4df2, #2459f6)',
            color: '#fff',
            display: 'grid',
            placeItems: 'center',
            fontWeight: 900,
          }}>K</div>
          <strong style={{ fontSize: '20px' }}>Kleza Excelliq AI</strong>
        </div>

        <div style={{
          width: '52px',
          height: '52px',
          borderRadius: '16px',
          background: '#fff3ed',
          color: '#dd7658',
          display: 'grid',
          placeItems: 'center',
          marginBottom: '18px',
        }}>
          <LockKeyhole size={25} />
        </div>

        <h1 style={{ fontSize: '38px', lineHeight: 1.05, margin: '0 0 10px', letterSpacing: '0' }}>
          Reset password
        </h1>
        <p style={{ color: '#62708a', fontSize: '17px', lineHeight: 1.6, margin: '0 0 30px' }}>
          Create a new password for your Excelliq account.
        </p>

        {sessionError ? (
          <div>
            <div style={{
              background: '#fff1f2',
              color: '#b42318',
              border: '1px solid #fecdd3',
              borderRadius: '14px',
              padding: '15px 16px',
              fontWeight: 700,
              marginBottom: '20px',
            }}>
              {sessionError}
            </div>
            <button
              type="button"
              onClick={goToLogin}
              style={{
                width: '100%',
                border: 'none',
                borderRadius: '12px',
                background: '#df795b',
                color: '#fff',
                padding: '15px 18px',
                fontSize: '17px',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Back to login
            </button>
          </div>
        ) : (
          <form onSubmit={submitNewPassword}>
            <label style={{ display: 'block', fontWeight: 800, marginBottom: '9px' }}>New password</label>
            <div style={{ position: 'relative', marginBottom: '18px' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={event => setPassword(event.target.value)}
                placeholder="Enter new password"
                disabled={!ready || busy || Boolean(message)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  border: '1px solid #d9e0ea',
                  borderRadius: '12px',
                  padding: '15px 48px 15px 18px',
                  fontSize: '18px',
                  outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(value => !value)}
                style={{
                  position: 'absolute',
                  right: '13px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  border: 'none',
                  background: 'transparent',
                  color: '#62708a',
                  cursor: 'pointer',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </div>

            <label style={{ display: 'block', fontWeight: 800, marginBottom: '9px' }}>Confirm password</label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={event => setConfirmPassword(event.target.value)}
              placeholder="Re-enter new password"
              disabled={!ready || busy || Boolean(message)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                border: '1px solid #d9e0ea',
                borderRadius: '12px',
                padding: '15px 18px',
                fontSize: '18px',
                outline: 'none',
                marginBottom: '14px',
              }}
            />

            {!ready && (
              <div style={{ color: '#62708a', fontWeight: 700, margin: '10px 0 18px' }}>
                Verifying reset link...
              </div>
            )}
            {error && (
              <div style={{
                background: '#fff1f2',
                color: '#b42318',
                border: '1px solid #fecdd3',
                borderRadius: '12px',
                padding: '13px 15px',
                fontWeight: 700,
                margin: '10px 0 18px',
              }}>
                {error}
              </div>
            )}
            {message && (
              <div style={{
                background: '#ecfdf3',
                color: '#027a48',
                border: '1px solid #abefc6',
                borderRadius: '12px',
                padding: '13px 15px',
                fontWeight: 800,
                margin: '10px 0 18px',
              }}>
                {message}
              </div>
            )}

            <button
              type={message ? 'button' : 'submit'}
              onClick={message ? goToLogin : undefined}
              disabled={!ready || busy}
              style={{
                width: '100%',
                border: 'none',
                borderRadius: '12px',
                background: ready && !busy ? '#df795b' : '#dce3ed',
                color: '#fff',
                padding: '15px 18px',
                fontSize: '17px',
                fontWeight: 900,
                cursor: ready && !busy ? 'pointer' : 'not-allowed',
                boxShadow: ready && !busy ? '0 15px 28px rgba(223, 121, 91, 0.22)' : 'none',
              }}
            >
              {message ? 'Go to login' : busy ? 'Updating...' : 'Update password'}
            </button>
          </form>
        )}
      </section>
    </main>
  );
};

export default ResetPasswordPage;
