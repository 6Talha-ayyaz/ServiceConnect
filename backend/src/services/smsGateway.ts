// Stub SMS gateway (A-5 / D-1 fallback). Swap for Twilio or a local aggregator in production.
// In non-production environments the OTP is logged to the console and echoed back in the
// API response (devOtp field) so the feature is testable without a real SMS account.
export async function sendSms(phone: string, message: string): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(`[SMS -> ${phone}] ${message}`);
}
