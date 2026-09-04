import { Resend } from "resend";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

// Lazy: constructing this at import time would throw in any environment
// (build, tests) that hasn't set RESEND_API_KEY yet.
function getClient(): Resend {
  return new Resend(requireEnv("RESEND_API_KEY"));
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const client = getClient();
  const from = process.env.EMAIL_FROM ?? "MarketingAI <onboarding@resend.dev>";
  const { error } = await client.emails.send({
    from,
    to: params.to,
    subject: params.subject,
    html: params.html,
  });
  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }
}
