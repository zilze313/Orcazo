// Centralised Zod schemas. Reuse across API routes + form clients.

import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(254)
  .email("Enter a valid email");

export const otpSchema = z
  .string()
  .trim()
  .regex(/^\d{4,8}$/, "Code must be 4–8 digits");

export const sendCodeBody = z.object({ email: emailSchema });
export const verifyCodeBody = z.object({ email: emailSchema, code: otpSchema });

export const adminLoginBody = z.object({
  email: emailSchema,
  password: z.string().min(1).max(200),
});

export const allowlistAddBody = z.object({
  email: emailSchema,
  note: z.string().max(500).optional().nullable(),
  proxyEmail: emailSchema.optional(),
});

export const allowlistConnectProxyBody = z.object({
  proxyEmail: emailSchema,
});

export const managedEmailAddBody = z.object({
  email: emailSchema,
  note: z.string().max(500).optional(),
});

// =============================================================
// Public-facing signup flows
// =============================================================

const SOCIAL_PLATFORMS = [
  "tiktok",
  "instagram",
  "youtube",
  "snapchat",
  "x",
  "facebook",
] as const;

export const REFERRAL_CODE = "orca353";

export const creatorSignupBody = z.object({
  publicEmail: emailSchema,
  fullName: z.string().trim().min(2, "Please enter your full name").max(120),
  whatsapp: z.string().trim().min(5, "Enter a valid WhatsApp number").max(40),
  referralCode: z
    .string()
    .trim()
    .refine((v) => v === REFERRAL_CODE, { message: "Invalid referral code" }),
  socialAccounts: z
    .array(
      z.object({
        platform: z.enum(SOCIAL_PLATFORMS),
        handle: z.string().trim().min(1).max(80),
      }),
    )
    .min(1, "At least one social account is required")
    .max(4, "Maximum 4 social accounts"),
  // Honeypot — humans leave this blank, bots fill it
  website: z.string().max(0, "Suspicious activity detected").optional(),
  turnstileToken: z.string().optional(),
});

export const brandSignupBody = z.object({
  email: emailSchema,
  brandName: z.string().trim().min(2, "Brand name is required").max(120),
  monthlyBudget: z.string().trim().min(1).max(80),
  // Honeypot
  website: z.string().max(0, "Suspicious activity detected").optional(),
  turnstileToken: z.string().optional(),
});

// =============================================================
// Admin signup-review actions
// =============================================================

export const approveCreatorBody = z.object({
  signupId: z.string().min(1).max(64),
  proxyEmail: emailSchema,
});

export const rejectCreatorBody = z.object({
  signupId: z.string().min(1).max(64),
  reason: z.string().trim().max(500).optional(),
});

export const markBrandContactedBody = z.object({
  id: z.string().min(1).max(64),
});

// =============================================================
// Payouts
// =============================================================

const CRYPTO_NETWORKS = [
  "BTC",
  "ETH",
  "USDC_ERC20",
  "USDC_TRC20",
  "USDT_ERC20",
  "USDT_TRC20",
  "SOL",
] as const;

export const payoutRequestBody = z.discriminatedUnion("method", [
  z.object({
    method: z.literal("BANK"),
    holderName: z.string().trim().min(2).max(120),
    bankName: z.string().trim().min(2).max(120),
    iban: z.string().trim().min(5).max(64),
    swift: z.string().trim().min(5).max(20),
    notes: z.string().trim().max(500).optional(),
  }),
  z.object({
    method: z.literal("CRYPTO"),
    network: z.enum(CRYPTO_NETWORKS),
    address: z.string().trim().min(10).max(200),
    notes: z.string().trim().max(500).optional(),
  }),
]);

export const updatePayoutStatusBody = z.object({
  id: z.string().min(1).max(64),
  status: z.enum(["REQUESTED", "IN_PROGRESS", "PAID", "CANCELLED"]),
  notes: z.string().trim().max(500).optional(),
});

export const allowlistRemoveBody = z.object({
  id: z.string().min(1),
});

export const submitPostBody = z.object({
  campaignPublicId: z.string().min(1).max(64),
  campaignName: z.string().min(1).max(200),
  linkSubmitted: z.string().url().max(2048),
  // Best-effort timezone from the browser; we fall back server-side.
  creatorTimezone: z.string().min(1).max(64).optional(),
});

export const applyToCampaignBody = z.object({
  campaignPublicId: z.string().min(1).max(64),
  socialPublicId: z.string().min(1).max(64),
});

export const addSocialBody = z.object({
  platform: z.enum([
    "instagram",
    "tiktok",
    "youtube",
    "snapchat",
    "x",
    "facebook",
  ]),
  handle: z.string().trim().min(1).max(80),
  language: z.string().trim().min(1).max(40).default("English"),
  theme: z.string().trim().min(1).max(80),
});

export const deleteSocialBody = z.object({
  publicId: z.string().min(1).max(64),
});

export const dashFiltersSchema = z.object({
  status: z.string().default("all"),
  campaignName: z.string().default("all"),
  onlySevenDays: z.coerce.boolean().default(false),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
