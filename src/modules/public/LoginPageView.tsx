import React, { useState } from 'react';
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  KeyRound,
  ArrowLeft,
  Building2,
  RefreshCw,
  HelpCircle,
  ExternalLink,
  Clock,
  Check,
  FileCode2,
  Shield,
} from 'lucide-react';
import { BrandLogo } from '../../components/BrandLogo';
import { User } from '../../types';
import { INITIAL_USERS } from '../../data/seedData';
import {
  generatePasswordResetToken,
  validatePasswordResetToken,
  executePasswordReset,
  PasswordResetTokenRecord,
} from '../../services/authService';

interface LoginPageViewProps {
  onLoginSuccess: (user: User) => void;
  onNavigateHome: () => void;
  redirectRoute?: string;
}

export const LoginPageView: React.FC<LoginPageViewProps> = ({
  onLoginSuccess,
  onNavigateHome,
  redirectRoute,
}) => {
  const [email, setEmail] = useState('admin@koshinnovations.com');
  const [password, setPassword] = useState('Kosh@2026!');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 2FA Verification State
  const [selectedUserPending2FA, setSelectedUserPending2FA] = useState<User | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpSentNotice, setOtpSentNotice] = useState<string | null>(null);

  // Forgot Password / Token Recovery Modal State
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [nonEnumNotice, setNonEnumNotice] = useState<string | null>(null);
  const [activeTokenRecord, setActiveTokenRecord] = useState<{
    token: string;
    obfuscatedRef: string;
    obfuscatedLink: string;
    expiresAtIso: string;
    email: string;
  } | null>(null);

  // Active Token Validation & Password Reset View State
  const [activeResetRef, setActiveResetRef] = useState<string | null>(null);
  const [tokenValidation, setTokenValidation] = useState<{
    isValid: boolean;
    record?: PasswordResetTokenRecord;
    errorReason?: string;
  } | null>(null);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [resetSuccessMessage, setResetSuccessMessage] = useState<string | null>(null);
  const [resetFormError, setResetFormError] = useState<string | null>(null);

  // Quick Select User Demo Helper
  const handleSelectDemoUser = (user: User) => {
    setEmail(user.email);
    setPassword('Kosh@2026!');
    setErrorMessage(null);
  };

  const handleAttemptLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);
      const foundUser = INITIAL_USERS.find(
        (u) => u.email.toLowerCase().trim() === email.toLowerCase().trim()
      );

      if (!foundUser) {
        setErrorMessage('Invalid username/email or password. Please verify your credentials.');
        return;
      }

      // Check if 2FA is required for this user
      if (foundUser.twoFactorEnabled) {
        setSelectedUserPending2FA(foundUser);
        setOtpSentNotice(`Two-factor verification OTP sent to ${foundUser.email} & verified WhatsApp number (+91 98401 22320).`);
        return;
      }

      // Login directly if 2FA is disabled
      onLoginSuccess(foundUser);
    }, 600);
  };

  const handleVerify2FA = (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError(null);

    if (otpCode.length !== 6) {
      setOtpError('Please enter a valid 6-digit numeric OTP code.');
      return;
    }

    if (otpCode !== '123456' && otpCode !== '888888') {
      setOtpError('Invalid OTP code. Please enter the demo code 123456.');
      return;
    }

    if (selectedUserPending2FA) {
      onLoginSuccess(selectedUserPending2FA);
    }
  };

  // Step 1: Request Password Reset Token (Non-enumerating with obfuscated link)
  const handleRequestPasswordReset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) return;

    const result = generatePasswordResetToken(resetEmail);
    setNonEnumNotice(result.genericMessage);

    if (result.token && result.obfuscatedRef && result.obfuscatedLink) {
      setActiveTokenRecord({
        token: result.token,
        obfuscatedRef: result.obfuscatedRef,
        obfuscatedLink: result.obfuscatedLink,
        expiresAtIso: result.expiresAtIso,
        email: resetEmail,
      });
    } else {
      setActiveTokenRecord(null);
    }
  };

  // Step 2: Validate Token & Open Reset Form using Obfuscated Ref
  const handleOpenTokenResetForm = (refToValidate: string) => {
    setActiveResetRef(refToValidate);
    const val = validatePasswordResetToken(refToValidate);
    setTokenValidation(val);
    setResetSuccessMessage(null);
    setResetFormError(null);
    setNewPassword('');
    setConfirmPassword('');
  };

  // Step 3: Execute Password Reset with Token Ref
  const handleExecuteResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setResetFormError(null);

    if (newPassword.length < 8) {
      setResetFormError('Password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setResetFormError('Passwords do not match. Please ensure both fields are identical.');
      return;
    }

    if (!activeResetRef) return;

    const res = executePasswordReset(activeResetRef, newPassword);

    if (!res.success) {
      setResetFormError(res.message);
      return;
    }

    setResetSuccessMessage(res.message);
    if (activeTokenRecord) {
      setEmail(activeTokenRecord.email);
    }
  };

  // Password Strength Checker Indicators
  const hasMinLength = newPassword.length >= 8;
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSpecial = /[^A-Za-z0-9]/.test(newPassword);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      {/* Background Accent Lines */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(14,165,233,0.12),rgba(255,255,255,0))]" />

      <div className="w-full max-w-md relative z-10 space-y-6">
        {/* Top Header Card */}
        <div className="text-center space-y-3">
          <button
            onClick={onNavigateHome}
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-cyan-400 transition-colors mb-2 cursor-pointer font-medium"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Public Home</span>
          </button>

          <div className="flex justify-center">
            <BrandLogo size="lg" />
          </div>

          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              My Kosh Innovations Global IT System
            </h1>
            <p className="text-xs text-cyan-400 font-semibold mt-0.5">
              Enterprise Governance & Master Portal Authentication
            </p>
          </div>
        </div>

        {/* Redirect Notice if user attempted protected page */}
        {redirectRoute && redirectRoute !== '/' && (
          <div className="bg-amber-950/80 border border-amber-800/80 rounded-xl p-3 flex items-start gap-2.5 text-xs text-amber-200">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-amber-100">Authentication Required:</span> You must sign in with authorized credentials to access <code className="bg-amber-900/60 px-1 py-0.5 rounded font-mono text-[11px]">{redirectRoute}</code>.
            </div>
          </div>
        )}

        {/* Login Box */}
        <div className="bg-[#0B192C]/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-md">
          {selectedUserPending2FA ? (
            /* 2FA Verification View */
            <form onSubmit={handleVerify2FA} className="space-y-5">
              <div className="text-center space-y-1">
                <div className="p-3 bg-purple-950 border border-purple-800/60 text-purple-400 rounded-xl w-fit mx-auto mb-2">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h2 className="text-base font-bold text-white">Two-Factor Authentication (2FA)</h2>
                <p className="text-xs text-slate-400">
                  Enter the 6-digit verification code sent to <span className="text-cyan-300 font-medium">{selectedUserPending2FA.email}</span>
                </p>
              </div>

              {otpSentNotice && (
                <div className="p-3 bg-blue-950/70 border border-blue-800 text-blue-200 text-xs rounded-lg flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <span>{otpSentNotice}</span>
                </div>
              )}

              {otpError && (
                <div className="p-3 bg-rose-950/80 border border-rose-800 text-rose-200 text-xs rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{otpError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  6-Digit Verification Code
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter 123456"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-center tracking-widest text-lg font-mono text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                  autoFocus
                />
                <p className="text-[11px] text-slate-400 mt-1.5 text-center">
                  Demo Security OTP: Use <code className="text-cyan-400 font-bold bg-slate-900 px-1.5 py-0.5 rounded">123456</code>
                </p>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Verify Security OTP</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedUserPending2FA(null)}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Cancel & Back
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOtpSentNotice('New 2FA security OTP dispatched to your registered mobile/email.');
                    setOtpError(null);
                  }}
                  className="text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Resend Code</span>
                </button>
              </div>
            </form>
          ) : (
            /* Primary Login Form */
            <form onSubmit={handleAttemptLogin} className="space-y-4">
              {errorMessage && (
                <div className="p-3 bg-rose-950/80 border border-rose-800/80 rounded-xl text-rose-200 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Corporate Username / Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. admin@koshinnovations.com"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-semibold text-slate-300">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgotModalOpen(true);
                      setNonEnumNotice(null);
                      setActiveTokenRecord(null);
                      setActiveResetRef(null);
                      setTokenValidation(null);
                    }}
                    className="text-[11px] text-cyan-400 hover:underline cursor-pointer font-medium"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-10 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-white cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-blue-600 focus:ring-0"
                  />
                  <span className="text-xs text-slate-300">Remember session on this device</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Authenticating User...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In to Governance Portal</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Quick Select Demo Accounts Box */}
          <div className="mt-6 pt-5 border-t border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold text-slate-400">Quick Test Account Selector:</p>
              <span className="text-[10px] text-cyan-400 bg-cyan-950 px-1.5 py-0.5 rounded border border-cyan-800/60 font-mono">Demo Role Presets</span>
            </div>

            <div className="grid grid-cols-1 gap-1.5">
              {INITIAL_USERS.map((usr) => (
                <button
                  key={usr.id}
                  type="button"
                  onClick={() => handleSelectDemoUser(usr)}
                  className={`w-full text-left p-2 rounded-lg text-[11px] transition-colors border flex items-center justify-between cursor-pointer ${
                    email === usr.email
                      ? 'bg-blue-950/80 border-blue-600 text-white font-semibold'
                      : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <div className="truncate">
                    <span className="font-bold">{usr.fullName}</span>
                    <span className="text-slate-400 block text-[10px]">{usr.email}</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-cyan-300 font-mono shrink-0">
                    {usr.role}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Security Policy Footnote */}
        <div className="text-center text-[11px] text-slate-500 space-y-1">
          <p>Confidential Internal Portal. Protected by SSL/TLS Encryption & Role-Based Access Controls.</p>
          <p>© {new Date().getFullYear()} Kosh Innovations Pvt Ltd.</p>
        </div>
      </div>

      {/* Forgot Password / Token Recovery Modal */}
      {isForgotModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl relative">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <KeyRound className="w-4.5 h-4.5 text-cyan-400" />
                <span>Account Access Recovery & Obfuscated Token Validation</span>
              </h3>
              <button
                onClick={() => {
                  setIsForgotModalOpen(false);
                  setNonEnumNotice(null);
                  setActiveTokenRecord(null);
                  setActiveResetRef(null);
                  setTokenValidation(null);
                }}
                className="text-slate-400 hover:text-white text-xs font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Sub-View A: Active Token Verification & Set New Password */}
            {activeResetRef ? (
              <div className="space-y-4 text-xs">
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400 font-semibold flex items-center gap-1">
                      <Shield className="w-3.5 h-3.5 text-cyan-400" />
                      <span>De-obfuscating Recovery Payload:</span>
                    </span>
                    <span className="text-cyan-400 font-semibold flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Single-Use 15-Min Expiry</span>
                    </span>
                  </div>
                  <div className="font-mono text-[10px] text-slate-400 truncate bg-slate-900 p-1.5 rounded border border-slate-800">
                    ref={activeResetRef}
                  </div>
                </div>

                {tokenValidation && !tokenValidation.isValid ? (
                  <div className="p-3.5 bg-rose-950/80 border border-rose-800 text-rose-200 rounded-xl space-y-2">
                    <p className="font-bold flex items-center gap-2 text-rose-300">
                      <AlertCircle className="w-4 h-4 text-rose-400" />
                      <span>Token Validation Failed</span>
                    </p>
                    <p className="text-[11px] leading-relaxed">{tokenValidation.errorReason}</p>
                    <button
                      onClick={() => {
                        setActiveResetRef(null);
                        setTokenValidation(null);
                      }}
                      className="mt-2 text-cyan-400 hover:underline font-semibold text-[11px] cursor-pointer"
                    >
                      ← Back to Request Recovery Link
                    </button>
                  </div>
                ) : resetSuccessMessage ? (
                  <div className="p-4 bg-emerald-950/80 border border-emerald-800 text-emerald-200 rounded-xl space-y-3">
                    <div className="flex items-center gap-2 text-emerald-300 font-bold text-sm">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                      <span>Password Updated Successfully</span>
                    </div>
                    <p className="text-xs leading-relaxed">{resetSuccessMessage}</p>
                    <button
                      onClick={() => {
                        setIsForgotModalOpen(false);
                        setActiveResetRef(null);
                        setResetSuccessMessage(null);
                      }}
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow cursor-pointer text-xs flex items-center justify-center gap-2"
                    >
                      <span>Proceed to Sign In</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleExecuteResetPassword} className="space-y-4">
                    <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 text-slate-300 leading-relaxed text-[11px]">
                      Token payload verified for <strong className="text-white font-mono">{tokenValidation?.record?.email}</strong>. Enter a strong new password below.
                    </div>

                    {resetFormError && (
                      <div className="p-3 bg-rose-950/80 border border-rose-800 text-rose-200 text-xs rounded-xl flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                        <span>{resetFormError}</span>
                      </div>
                    )}

                    <div>
                      <label className="block font-semibold text-slate-300 mb-1">New Password</label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                        <input
                          type={showNewPassword ? 'text' : 'password'}
                          required
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Min. 8 characters"
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-10 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3 top-2.5 text-slate-400 hover:text-white cursor-pointer"
                        >
                          {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>

                      {/* Live Password Strength Checklist */}
                      <div className="mt-2.5 grid grid-cols-2 gap-1.5 text-[10px]">
                        <div className={`flex items-center gap-1.5 ${hasMinLength ? 'text-emerald-400 font-semibold' : 'text-slate-500'}`}>
                          {hasMinLength ? <Check className="w-3 h-3 text-emerald-400" /> : <span className="w-3 h-3 inline-block text-center">•</span>}
                          <span>At least 8 characters</span>
                        </div>
                        <div className={`flex items-center gap-1.5 ${hasUppercase ? 'text-emerald-400 font-semibold' : 'text-slate-500'}`}>
                          {hasUppercase ? <Check className="w-3 h-3 text-emerald-400" /> : <span className="w-3 h-3 inline-block text-center">•</span>}
                          <span>Uppercase letter</span>
                        </div>
                        <div className={`flex items-center gap-1.5 ${hasNumber ? 'text-emerald-400 font-semibold' : 'text-slate-500'}`}>
                          {hasNumber ? <Check className="w-3 h-3 text-emerald-400" /> : <span className="w-3 h-3 inline-block text-center">•</span>}
                          <span>Number (0-9)</span>
                        </div>
                        <div className={`flex items-center gap-1.5 ${hasSpecial ? 'text-emerald-400 font-semibold' : 'text-slate-500'}`}>
                          {hasSpecial ? <Check className="w-3 h-3 text-emerald-400" /> : <span className="w-3 h-3 inline-block text-center">•</span>}
                          <span>Special character</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-300 mb-1">Confirm New Password</label>
                      <input
                        type="password"
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter new password"
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                      />
                    </div>

                    <div className="flex gap-2 justify-end pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveResetRef(null);
                          setTokenValidation(null);
                        }}
                        className="px-4 py-2 bg-slate-800 text-slate-300 hover:text-white rounded-xl cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl cursor-pointer flex items-center gap-1.5"
                      >
                        <span>Update Password & Save</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </form>
                )}
              </div>
            ) : nonEnumNotice ? (
              /* Sub-View B: Non-Enumerating Token Request Dispatch Result with Obfuscated Recovery Link */
              <div className="space-y-4 text-xs">
                <div className="p-3.5 bg-blue-950/80 border border-blue-800 text-blue-100 rounded-xl space-y-2">
                  <p className="font-bold text-cyan-300 flex items-center gap-2">
                    <ShieldCheck className="w-4.5 h-4.5 text-cyan-400" />
                    <span>Non-Enumerating Recovery Notice</span>
                  </p>
                  <p className="text-[11px] leading-relaxed">{nonEnumNotice}</p>
                </div>

                {/* Simulated Obfuscated Outbound Email Box */}
                {activeTokenRecord ? (
                  <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1">
                        <FileCode2 className="w-3.5 h-3.5 text-cyan-400" />
                        Simulated Outbound Email (Obfuscated Link Generated)
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">15-Min Expiry</span>
                    </div>

                    <div className="space-y-1.5 text-[11px]">
                      <p><span className="text-slate-400">Recipient:</span> <strong className="text-white">{activeTokenRecord.email}</strong></p>
                      <div>
                        <span className="text-slate-400 block mb-0.5">Obfuscated Recovery URL:</span>
                        <div className="bg-slate-900 border border-slate-800 p-2 rounded font-mono text-[10px] text-cyan-300 break-all">
                          {activeTokenRecord.obfuscatedLink}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleOpenTokenResetForm(activeTokenRecord.obfuscatedRef)}
                      className="w-full py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs rounded-xl shadow cursor-pointer flex items-center justify-center gap-2"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Simulate Opening Obfuscated Email Link</span>
                    </button>
                  </div>
                ) : (
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-[11px] text-slate-400">
                    If this address was not registered, no token was generated in the database.
                  </div>
                )}

                <div className="flex justify-between items-center pt-2 border-t border-slate-800">
                  <button
                    onClick={() => {
                      setNonEnumNotice(null);
                      setActiveTokenRecord(null);
                    }}
                    className="text-slate-400 hover:text-white transition-colors cursor-pointer text-[11px]"
                  >
                    ← Request for Another Email
                  </button>
                  <button
                    onClick={() => setIsForgotModalOpen(false)}
                    className="px-4 py-2 bg-slate-800 text-slate-300 hover:text-white rounded-xl cursor-pointer text-xs font-semibold"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              /* Sub-View C: Request Token Form */
              <form onSubmit={handleRequestPasswordReset} className="space-y-4 text-xs">
                <p className="text-slate-300 leading-relaxed">
                  Enter your registered corporate email address to receive an obfuscated time-limited single-use password recovery link.
                </p>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Corporate Email Address</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="email"
                      required
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="e.g. admin@koshinnovations.com"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                    />
                  </div>
                </div>

                <div className="flex gap-2 justify-end pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsForgotModalOpen(false)}
                    className="px-4 py-2 bg-slate-800 text-slate-300 hover:text-white rounded-xl cursor-pointer font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl cursor-pointer flex items-center gap-1.5 shadow-md"
                  >
                    <span>Generate Obfuscated Link</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
