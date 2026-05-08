import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import { Lock, Mail, Eye, EyeOff, Loader2, ShieldCheck, ArrowRight, KeyRound } from 'lucide-react';

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    // Check if we're in recovery mode (redirected from reset email)
    if (window.location.hash && window.location.hash.includes('type=recovery')) {
      setIsRecovery(true);
    }
  }, []);

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      if (isRecovery) {
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match');
        }
        const { error } = await supabase.auth.updateUser({
          password: password,
        });
        if (error) throw error;
        setSuccess(true);
        // Clear recovery mode after success
        setTimeout(() => {
          setIsRecovery(false);
          setSuccess(false);
          window.location.hash = '';
        }, 3000);
      } else if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        setSuccess(true);
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Please enter your email first.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      if (error) throw error;
      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getTitle = () => {
    if (isRecovery) return 'Reset Password';
    if (isSignUp) return 'Create Workspace';
    return 'Welcome Back';
  };

  const getSubtitle = () => {
    if (isRecovery) return 'Enter your new secure password';
    if (isSignUp) return 'Join Fine Space Interior team';
    return 'Secure sign in to your projects';
  };

  return (
    <div className="auth-container">
      <div className="auth-card glass fade-in">
        <div className="auth-header">
          <div className="logo-icon-large">FS</div>
          <h2>{getTitle()}</h2>
          <p>{getSubtitle()}</p>
        </div>

        <form onSubmit={handleAuth} className="auth-form">
          {!isRecovery && (
            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <div className="input-with-icon">
                <Mail size={18} className="input-icon" />
                <input
                  id="email"
                  type="email"
                  placeholder="designer@finespace.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="password">{isRecovery ? 'New Password' : 'Password'}</label>
            <div className="input-with-icon">
              {isRecovery ? <KeyRound size={18} className="input-icon" /> : <Lock size={18} className="input-icon" />}
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {isRecovery && (
            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm New Password</label>
              <div className="input-with-icon">
                <Lock size={18} className="input-icon" />
                <input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
            </div>
          )}

          {!isSignUp && !isRecovery && (
            <div className="auth-extras">
              <button type="button" onClick={handleForgotPassword} className="forgot-link">
                Forgot password?
              </button>
            </div>
          )}

          {error && <div className="auth-error">{error}</div>}
          {success && (
            <div className="auth-success">
              {isRecovery 
                ? 'Password updated successfully! Redirecting to login...' 
                : isSignUp 
                  ? 'Check your email for confirmation!' 
                  : 'Password reset link sent!'}
            </div>
          )}

          <button type="submit" disabled={loading} className="auth-submit-btn">
            {loading ? (
              <Loader2 className="animate-spin" />
            ) : (
              <>
                {isRecovery ? 'Update Password' : isSignUp ? 'Sign Up' : 'Sign In'}
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        {!isRecovery && (
          <div className="auth-footer">
            <p>
              {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
              <button onClick={() => setIsSignUp(!isSignUp)} className="toggle-auth">
                {isSignUp ? 'Sign In' : 'Sign Up'}
              </button>
            </p>
          </div>
        )}

        {isRecovery && (
          <div className="auth-footer">
            <button onClick={() => { setIsRecovery(false); window.location.hash = ''; }} className="toggle-auth">
              Back to Login
            </button>
          </div>
        )}

        <div className="security-badge">
          <ShieldCheck size={14} />
          <span>100% Secure AES-256 Encrypted</span>
        </div>
      </div>
    </div>
  );
}
