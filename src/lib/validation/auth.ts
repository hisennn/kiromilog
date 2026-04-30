import { z } from "zod";

export const signInSchema = z.object({
  email: z.email().trim(),
  password: z.string().min(8).max(128),
});

export const signUpSchema = z.object({
  name: z.string().trim().min(2).max(50),
  email: z.email().trim(),
  password: z
    .string()
    .min(8)
    .max(128)
    .regex(/[A-Za-z]/)
    .regex(/[0-9]/),
});

export type AuthActionState = {
  error?: string;
  success?: string;
  cooldownSeconds?: number;
  fieldErrors?: {
    name?: string[];
    email?: string[];
    password?: string[];
  };
};
