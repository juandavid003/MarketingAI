import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { stripe } from "@better-auth/stripe";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

// Pinned to the version this "stripe" package build was generated against
// (node_modules/stripe/cjs/apiVersion.d.ts) rather than left to drift with
// the Stripe account's dashboard-configured default.
const stripeClient = new Stripe(requireEnv("STRIPE_SECRET_KEY"), {
  apiVersion: "2026-08-26.dahlia",
});

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  baseURL: process.env.BETTER_AUTH_URL,
  secret: requireEnv("BETTER_AUTH_SECRET"),

  emailAndPassword: {
    enabled: true,
    // Sin proveedor de correo configurado (Resend) los clientes se crean
    // directamente con email + contraseña ya definidos — no hay enlace de
    // verificación que enviar. Reactivar cuando haya RESEND_API_KEY real.
    requireEmailVerification: false,
    sendResetPassword: async ({ user, url }) => {
      // Fire-and-forget by design (avoid awaiting email sends on the auth
      // response — see the guide this callback shape came from), but still
      // caught so a bad RESEND_API_KEY surfaces as a clean log line instead
      // of an unhandled promise rejection crash warning.
      sendEmail({
        to: user.email,
        subject: "Restablece tu contraseña de MarketingAI",
        html: `<p>Haz clic para restablecer tu contraseña:</p><p><a href="${url}">${url}</a></p><p>Si no fuiste tú, ignora este correo.</p>`,
      }).catch((err) => console.error("No se pudo enviar el correo de restablecimiento:", err));
    },
  },

  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      sendEmail({
        to: user.email,
        subject: "Confirma tu correo en MarketingAI",
        html: `<p>Haz clic para confirmar tu correo:</p><p><a href="${url}">${url}</a></p>`,
      }).catch((err) => console.error("No se pudo enviar el correo de verificación:", err));
    },
    sendOnSignUp: false,
    autoSignInAfterVerification: true,
  },

  plugins: [
    stripe({
      stripeClient,
      stripeWebhookSecret: requireEnv("STRIPE_WEBHOOK_SECRET"),
      createCustomerOnSignUp: true,
      subscription: {
        enabled: true,
        plans: [
          {
            name: "pro",
            priceId: requireEnv("STRIPE_PRICE_ID"),
          },
        ],
      },
    }),
  ],
});
