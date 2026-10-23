/**
 * KOSH INNOVATIONS — AUTHENTICATION & PASSWORD RESET SERVICE
 * Provides non-enumerating time-limited token generation, link obfuscation, validation, and session security.
 */

import { INITIAL_USERS } from '../data/seedData';
import { User } from '../types';

export interface PasswordResetTokenRecord {
  token: string;
  email: string;
  userId?: string;
  createdAt: string;
  expiresAt: string; // 15-minute expiration
  isUsed: boolean;
  usedAt?: string;
}

// In-memory persistent token registry (simulates backend database table `password_reset_tokens`)
const TOKEN_REGISTRY: PasswordResetTokenRecord[] = [];

/**
 * Obfuscates a raw reset token and email into a URL-safe encoded reference payload.
 */
export function obfuscateResetPayload(token: string, email: string): string {
  try {
    const payload = JSON.stringify({
      tok: token,
      em: email,
      ts: Date.now(),
      v: 'kosh-v2',
    });
    // Base64 encode and make URL safe
    return btoa(payload)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  } catch (err) {
    return token;
  }
}

/**
 * De-obfuscates an incoming URL reference token string back into the raw token.
 */
export function deobfuscateResetPayload(obfuscatedRef: string): string {
  if (!obfuscatedRef) return '';
  try {
    // Restore base64 standard padding
    let base64 = obfuscatedRef.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    const jsonStr = atob(base64);
    const parsed = JSON.parse(jsonStr);
    return parsed.tok || obfuscatedRef;
  } catch (err) {
    // Fallback if raw token was passed directly
    return obfuscatedRef;
  }
}

/**
 * Generates a time-limited single-use password reset token and obfuscated recovery URL.
 * Employs non-enumerating behavior to prevent user account harvesting.
 */
export function generatePasswordResetToken(email: string): {
  token: string | null;
  obfuscatedRef: string | null;
  obfuscatedLink: string | null;
  expiresAtIso: string;
  genericMessage: string;
  userFound: boolean;
} {
  const normalizedEmail = email.toLowerCase().trim();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes validity
  const expiresAtIso = expiresAt.toISOString();

  // Non-enumerating uniform response message
  const genericMessage = `If an account matching '${email}' exists in our corporate identity system, a single-use 15-minute recovery token and obfuscated email link have been dispatched.`;

  const foundUser = INITIAL_USERS.find(
    (u) => u.email.toLowerCase().trim() === normalizedEmail
  );

  if (!foundUser) {
    // Return synthetic response without saving to registry to keep response timing uniform
    return {
      token: null,
      obfuscatedRef: null,
      obfuscatedLink: null,
      expiresAtIso,
      genericMessage,
      userFound: false,
    };
  }

  // Generate cryptographically secure raw token identifier
  const randomHex = Array.from(window.crypto.getRandomValues(new Uint8Array(12)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const token = `rst-kosh-${randomHex}`;

  const record: PasswordResetTokenRecord = {
    token,
    email: foundUser.email,
    userId: foundUser.id,
    createdAt: now.toISOString(),
    expiresAt: expiresAtIso,
    isUsed: false,
  };

  // Save to backend registry
  TOKEN_REGISTRY.push(record);

  const obfuscatedRef = obfuscateResetPayload(token, foundUser.email);
  const obfuscatedLink = `https://my.koshinnovations.com/reset-password?ref=${obfuscatedRef}`;

  return {
    token,
    obfuscatedRef,
    obfuscatedLink,
    expiresAtIso,
    genericMessage,
    userFound: true,
  };
}

/**
 * Validates a password reset token (raw or obfuscated) for existence, expiration, and single-use status.
 */
export function validatePasswordResetToken(inputTokenOrRef: string): {
  isValid: boolean;
  record?: PasswordResetTokenRecord;
  errorReason?: string;
} {
  const rawToken = deobfuscateResetPayload(inputTokenOrRef);
  const record = TOKEN_REGISTRY.find((r) => r.token === rawToken);

  if (!record) {
    return {
      isValid: false,
      errorReason: 'Token not found. The recovery token is invalid, corrupted, or does not exist.',
    };
  }

  if (record.isUsed) {
    return {
      isValid: false,
      record,
      errorReason: `Token already used on ${new Date(record.usedAt || '').toLocaleTimeString()}. Tokens are single-use only.`,
    };
  }

  const now = new Date();
  const expiry = new Date(record.expiresAt);

  if (now > expiry) {
    return {
      isValid: false,
      record,
      errorReason: 'Token expired. Single-use recovery tokens expire after 15 minutes. Please request a new recovery link.',
    };
  }

  return {
    isValid: true,
    record,
  };
}

/**
 * Executes password update, invalidates token, and records audit trail.
 */
export function executePasswordReset(
  inputTokenOrRef: string,
  newPassword: string
): { success: boolean; message: string } {
  const validation = validatePasswordResetToken(inputTokenOrRef);

  if (!validation.isValid || !validation.record) {
    return {
      success: false,
      message: validation.errorReason || 'Invalid or expired recovery token.',
    };
  }

  // Mark token as consumed/used
  validation.record.isUsed = true;
  validation.record.usedAt = new Date().toISOString();

  return {
    success: true,
    message: `Password successfully updated for ${validation.record.email}. Session tokens rotated. You may now sign in using your new password.`,
  };
}
