import React, { useState, useEffect } from 'react';
import { Mail, Phone, Lock, User, ShieldCheck, ArrowRight, RotateCw, LogIn, UserPlus, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { Modal, Input, Button, OtpInput } from '../ui/index.js';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'LOGIN' | 'REGISTER';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'LOGIN'
}) => {
  const { login, sendOtp, registerWithOtp } = useAuth();

  const [activeTab, setActiveTab] = useState<'LOGIN' | 'REGISTER'>(initialTab);
  const [authType, setAuthType] = useState<'EMAIL' | 'PHONE'>('EMAIL');

  // Login form state
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register form state
  const [regUsername, setRegUsername] = useState('');
  const [regIdentifier, setRegIdentifier] = useState('');
  const [regPassword, setRegPassword] = useState('');

  // OTP Verification state
  const [step, setStep] = useState<'DETAILS' | 'OTP'>('DETAILS');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Status state
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    setActiveTab(initialTab);
    setErrorMessage(null);
    setSuccessMessage(null);
    setStep('DETAILS');
    setOtpDigits(['', '', '', '', '', '']);
    setDevOtp(null);
    setPreviewUrl(null);
  }, [initialTab, isOpen]);

  // Resend timer countdown with tabular interval
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  if (!isOpen) return null;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    const res = await login(loginIdentifier, loginPassword);
    setIsLoading(false);

    if (res.success) {
      onClose();
    } else {
      setErrorMessage(res.error || 'Failed to sign in. Please verify your credentials.');
    }
  };

  const handleSendOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!regUsername.trim() || regUsername.length < 3) {
      setErrorMessage('Username must be at least 3 characters.');
      return;
    }
    if (!regIdentifier.trim()) {
      setErrorMessage(authType === 'EMAIL' ? 'Please enter a valid email address.' : 'Please enter a valid phone number.');
      return;
    }
    if (regPassword.length < 8) {
      setErrorMessage('Password must be at least 8 characters.');
      return;
    }

    setIsLoading(true);
    const res = await sendOtp(regIdentifier.trim(), authType);
    setIsLoading(false);

    if (res.success) {
      setStep('OTP');
      setSuccessMessage(
        authType === 'EMAIL'
          ? `Verification email sent to ${regIdentifier.trim()}. Please check your inbox.`
          : `Verification SMS sent to ${regIdentifier.trim()}.`
      );
      setPreviewUrl(res.previewUrl || null);
      // Only expose dev OTP for simulated phone testing in development, never for email
      if (res.devOtpCode && authType === 'PHONE') {
        setDevOtp(res.devOtpCode);
      } else {
        setDevOtp(null);
      }
      setResendCooldown(60);
    } else {
      setErrorMessage(res.error || 'Failed to send verification code.');
      if (res.cooldownSeconds) {
        setResendCooldown(res.cooldownSeconds);
      }
    }
  };

  const handleVerifyAndRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const code = otpDigits.join('');
    if (code.length !== 6) {
      setErrorMessage('Please enter all 6 digits of your verification code.');
      return;
    }

    setIsLoading(true);
    const res = await registerWithOtp(
      regUsername.trim(),
      regIdentifier.trim(),
      authType,
      regPassword,
      code
    );
    setIsLoading(false);

    if (res.success) {
      onClose();
    } else {
      setErrorMessage(res.error || 'Verification failed. Please check your 6-digit code.');
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setErrorMessage(null);
    setIsLoading(true);
    const res = await sendOtp(regIdentifier.trim(), authType);
    setIsLoading(false);

    if (res.success) {
      setSuccessMessage(
        authType === 'EMAIL'
          ? `A new verification code has been dispatched to ${regIdentifier.trim()}.`
          : `New code sent to ${regIdentifier.trim()}`
      );
      setPreviewUrl(res.previewUrl || null);
      if (res.devOtpCode && authType === 'PHONE') {
        setDevOtp(res.devOtpCode);
      }
      setResendCooldown(60);
    } else {
      setErrorMessage(res.error || 'Failed to resend verification code.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        activeTab === 'LOGIN'
          ? 'Sign In to Rummy Royale'
          : step === 'OTP'
          ? 'Verify Security Code'
          : 'Create Your Account'
      }
      subtitle={
        activeTab === 'LOGIN'
          ? 'Access your authenticated stats, match history, and profile'
          : step === 'OTP'
          ? `Enter the 6-digit code dispatched to ${regIdentifier}`
          : 'Register for verified ranked match history and persistent stats'
      }
      icon={
        activeTab === 'LOGIN' ? (
          <LogIn size={20} />
        ) : step === 'OTP' ? (
          <ShieldCheck size={20} />
        ) : (
          <UserPlus size={20} />
        )
      }
      maxWidth="480px"
    >
      <div className="auth-modal-card">
        {/* Top-Level Mode Tabs */}
        {step === 'DETAILS' && (
          <div className="auth-tab-bar" style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
            <Button
              variant={activeTab === 'LOGIN' ? 'gold' : 'ghost'}
              size="sm"
              fullWidth
              leftIcon={<LogIn size={15} />}
              onClick={() => {
                setActiveTab('LOGIN');
                setErrorMessage(null);
              }}
            >
              Sign In
            </Button>
            <Button
              variant={activeTab === 'REGISTER' ? 'gold' : 'ghost'}
              size="sm"
              fullWidth
              leftIcon={<UserPlus size={15} />}
              onClick={() => {
                setActiveTab('REGISTER');
                setErrorMessage(null);
              }}
            >
              Create Account
            </Button>
          </div>
        )}

        {/* Status Alerts */}
        {errorMessage && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 14px',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              borderRadius: '10px',
              color: '#fca5a5',
              fontSize: '0.85rem',
              marginBottom: '16px'
            }}
            role="alert"
          >
            <AlertCircle size={16} style={{ flexShrink: 0, color: '#ef4444' }} />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 14px',
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              borderRadius: '10px',
              color: '#6ee7b7',
              fontSize: '0.85rem',
              marginBottom: '16px'
            }}
          >
            <CheckCircle2 size={16} style={{ flexShrink: 0, color: '#10b981' }} />
            <span>{successMessage}</span>
          </div>
        )}

        {previewUrl && (
          <div
            style={{
              padding: '10px 14px',
              background: 'rgba(212, 175, 55, 0.1)',
              border: '1px solid rgba(212, 175, 55, 0.35)',
              borderRadius: '10px',
              color: '#f6e05e',
              fontSize: '0.82rem',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px'
            }}
          >
            <span>
              ℹ️ Real SMTP not configured in <code>.env</code>. Email delivered to test mailbox:
            </span>
            <a
              href={previewUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                color: '#ffffff',
                background: 'rgba(212, 175, 55, 0.3)',
                padding: '4px 10px',
                borderRadius: '6px',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: '0.78rem',
                flexShrink: 0
              }}
            >
              Open Email Inbox ↗
            </a>
          </div>
        )}

        {/* ─── TAB 1: LOGIN ────────────────────────────────────────── */}
        {activeTab === 'LOGIN' && (
          <form onSubmit={handleLoginSubmit}>
            <Input
              id="login-identifier"
              label="Username, Email, or Mobile Phone"
              value={loginIdentifier}
              onChange={(e) => setLoginIdentifier(e.target.value)}
              placeholder="e.g. admin or player@domain.com"
              leftIcon={<User size={18} />}
              isRequired
              autoFocus
            />

            <Input
              id="login-password"
              type="password"
              label="Password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              placeholder="••••••••••••"
              leftIcon={<Lock size={18} />}
              showPasswordToggle
              isRequired
            />

            <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <Button
                id="btn-auth-login"
                type="submit"
                variant="gold"
                size="lg"
                fullWidth
                isLoading={isLoading}
                rightIcon={<ArrowRight size={18} />}
              >
                Sign In to Account
              </Button>

              <div style={{ textAlign: 'center', marginTop: '4px' }}>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                >
                  Skip for now, play in Guest Mode →
                </Button>
              </div>
            </div>
          </form>
        )}

        {/* ─── TAB 2: REGISTER (DETAILS STEP) ──────────────────────── */}
        {activeTab === 'REGISTER' && step === 'DETAILS' && (
          <form onSubmit={handleSendOtpSubmit}>
            {/* Channel Selection Toggle */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '18px' }}>
              <Button
                type="button"
                variant={authType === 'EMAIL' ? 'secondary' : 'outline'}
                size="sm"
                fullWidth
                leftIcon={<Mail size={15} />}
                onClick={() => setAuthType('EMAIL')}
                style={{
                  borderColor: authType === 'EMAIL' ? '#d4af37' : undefined,
                  color: authType === 'EMAIL' ? '#f6e05e' : undefined
                }}
              >
                📧 Email Address
              </Button>
              <Button
                type="button"
                variant={authType === 'PHONE' ? 'secondary' : 'outline'}
                size="sm"
                fullWidth
                leftIcon={<Phone size={15} />}
                onClick={() => setAuthType('PHONE')}
                style={{
                  borderColor: authType === 'PHONE' ? '#d4af37' : undefined,
                  color: authType === 'PHONE' ? '#f6e05e' : undefined
                }}
              >
                📱 Mobile Phone
              </Button>
            </div>

            <Input
              id="reg-username"
              label="Player Username"
              value={regUsername}
              onChange={(e) => setRegUsername(e.target.value)}
              placeholder="e.g. RoyalAce77"
              leftIcon={<User size={18} />}
              helperText="Min. 3 characters. Unique display handle."
              isRequired
              autoFocus
            />

            <Input
              id="reg-identifier"
              type={authType === 'EMAIL' ? 'email' : 'tel'}
              label={authType === 'EMAIL' ? 'Email Address (Verification code will be sent here)' : 'Mobile Phone Number (+91...)'}
              value={regIdentifier}
              onChange={(e) => setRegIdentifier(e.target.value)}
              placeholder={authType === 'EMAIL' ? 'you@domain.com' : '+919876543210'}
              leftIcon={authType === 'EMAIL' ? <Mail size={18} /> : <Phone size={18} />}
              isRequired
            />

            <Input
              id="reg-password"
              type="password"
              label="Account Password"
              value={regPassword}
              onChange={(e) => setRegPassword(e.target.value)}
              placeholder="••••••••••••"
              leftIcon={<Lock size={18} />}
              helperText="At least 8 characters. Keep it secure."
              showPasswordToggle
              isRequired
            />

            <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <Button
                id="btn-send-otp"
                type="submit"
                variant="gold"
                size="lg"
                fullWidth
                isLoading={isLoading}
                rightIcon={<ArrowRight size={18} />}
              >
                {authType === 'EMAIL' ? 'Send Email Verification Code' : 'Send SMS Verification Code'}
              </Button>

              <div style={{ textAlign: 'center', marginTop: '4px' }}>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                >
                  No account needed, continue as Guest →
                </Button>
              </div>
            </div>
          </form>
        )}

        {/* ─── TAB 2: REGISTER (OTP STEP) ──────────────────────────── */}
        {activeTab === 'REGISTER' && step === 'OTP' && (
          <form onSubmit={handleVerifyAndRegister}>
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <p style={{ fontSize: '0.92rem', color: '#94a3b8', margin: '0 0 10px 0', lineHeight: '1.5' }}>
                {authType === 'EMAIL' ? (
                  <>
                    We sent a 6-digit code to <strong style={{ color: '#f8fafc' }}>{regIdentifier}</strong>.
                    <br />
                    Please check your email inbox or spam folder.
                  </>
                ) : (
                  <>
                    Enter the 6-digit SMS code sent to <strong style={{ color: '#f8fafc' }}>{regIdentifier}</strong>.
                  </>
                )}
              </p>

              {/* Dev OTP indicator for automated tests on simulated phone channel */}
              {devOtp && (
                <div
                  className="dev-otp-badge"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 14px',
                    background: 'rgba(212, 175, 55, 0.12)',
                    border: '1px solid rgba(212, 175, 55, 0.4)',
                    borderRadius: '8px',
                    color: '#f6e05e',
                    fontSize: '0.85rem',
                    marginBottom: '16px'
                  }}
                >
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em' }}>DEV TEST CODE:</span>
                  <code style={{ fontWeight: 800, fontSize: '1rem', letterSpacing: '2px' }}>{devOtp}</code>
                </div>
              )}
            </div>

            {/* 6 Discrete Digit Boxes */}
            <OtpInput
              value={otpDigits}
              onChange={(digits) => {
                setOtpDigits(digits);
                if (errorMessage) setErrorMessage(null);
              }}
              hasError={Boolean(errorMessage)}
              autoFocus
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '24px' }}>
              <Button
                id="btn-verify-otp"
                type="submit"
                variant="primary"
                size="lg"
                fullWidth
                isLoading={isLoading}
                leftIcon={<ShieldCheck size={18} />}
              >
                Verify Code & Finish Sign Up
              </Button>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setStep('DETAILS')}
                >
                  ← Edit Details
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={resendCooldown > 0 || isLoading}
                  leftIcon={<RotateCw size={14} />}
                  onClick={handleResendOtp}
                >
                  {resendCooldown > 0 ? (
                    <span>
                      Resend in <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{resendCooldown}s</strong>
                    </span>
                  ) : (
                    'Resend Code'
                  )}
                </Button>
              </div>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
};
