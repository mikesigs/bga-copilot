export type ValidationResult = { ok: true } | { ok: false; error: string };

export type KeyValidator = (apiKey: string, fetchImpl?: typeof fetch) => Promise<ValidationResult>;
