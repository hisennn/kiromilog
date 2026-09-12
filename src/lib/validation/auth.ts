import { z } from "zod";

const nicknameSchema = z
  .string()
  .trim()
  .min(3, "Nickname must be at least 3 characters.")
  .max(30, "Nickname can be at most 30 characters.")
  .regex(
    /^[a-zA-Z0-9_.-]+$/,
    "Use only letters, numbers, dots, hyphens, or underscores.",
  );

export const signInSchema = z.object({
  email: z.email("Enter a valid email.").trim(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(128, "Password can be at most 128 characters."),
});

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(128, "Password can be at most 128 characters.")
  .regex(/[A-Za-z]/, "Password must include a letter.")
  .regex(/[0-9]/, "Password must include a number.");

export const signUpSchema = z.object({
  nickname: nicknameSchema,
  email: z.email("Enter a valid email.").trim(),
  password: passwordSchema,
});

export const requestPasswordResetSchema = z.object({
  email: z.email("Enter a valid email.").trim(),
});

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(1, "Invalid reset link."),
  newPassword: passwordSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().max(128, "Password can be at most 128 characters."),
  newPassword: passwordSchema,
});

export type AuthActionState = {
  error?: string;
  success?: string;
  cooldownSeconds?: number;
  fieldErrors?: {
    nickname?: string[];
    email?: string[];
    password?: string[];
  };
};
