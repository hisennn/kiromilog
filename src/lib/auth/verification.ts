export const VERIFICATION_RESEND_COOLDOWN_SECONDS = 60;
export const VERIFICATION_RESEND_COOKIE = "verification_resend_at";
export const PENDING_VERIFICATION_EMAIL_COOKIE = "pending_verification_email";

export function getVerificationCooldownRemaining(lastSentAt: number | null) {
  if (!lastSentAt) {
    return 0;
  }

  const elapsedSeconds = Math.floor((Date.now() - lastSentAt) / 1000);
  return Math.max(0, VERIFICATION_RESEND_COOLDOWN_SECONDS - elapsedSeconds);
}
