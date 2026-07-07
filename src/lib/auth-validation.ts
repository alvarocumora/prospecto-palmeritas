import { z } from "zod";

// Reusable field schemas with ES messages
export const emailSchema = z
  .string({ required_error: "El email es obligatorio." })
  .trim()
  .min(1, "El email es obligatorio.")
  .max(255, "El email no puede superar 255 caracteres.")
  .email("Ingresa un email válido (ej: nombre@empresa.com).");

export const passwordSchema = z
  .string({ required_error: "La contraseña es obligatoria." })
  .min(8, "La contraseña debe tener al menos 8 caracteres.")
  .max(100, "La contraseña no puede superar 100 caracteres.")
  .regex(/[A-Z]/, "Debe incluir al menos una letra mayúscula.")
  .regex(/[a-z]/, "Debe incluir al menos una letra minúscula.")
  .regex(/\d/, "Debe incluir al menos un número.");

export const displayNameSchema = z
  .string()
  .trim()
  .min(2, "El nombre debe tener al menos 2 caracteres.")
  .max(100, "El nombre no puede superar 100 caracteres.")
  .regex(/^[\p{L}\p{M}\s'.-]+$/u, "Solo se permiten letras, espacios, apóstrofes y guiones.");

export const loginSchema = z.object({
  email: emailSchema,
  password: z
    .string({ required_error: "La contraseña es obligatoria." })
    .min(1, "La contraseña es obligatoria."),
});

export const signupSchema = z.object({
  displayName: displayNameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirm: z.string().min(1, "Confirma la nueva contraseña."),
  })
  .refine((v) => v.password === v.confirm, {
    path: ["confirm"],
    message: "Las contraseñas no coinciden.",
  });

export type FieldErrors<T extends string> = Partial<Record<T, string>>;

export function zodToFieldErrors<T extends string>(err: z.ZodError): FieldErrors<T> {
  const out: FieldErrors<T> = {};
  for (const issue of err.issues) {
    const key = issue.path[0] as T | undefined;
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}
