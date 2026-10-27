// filename: lib/errors.ts
export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function ensure(
  condition: unknown,
  status: number,
  message: string,
): asserts condition {
  if (!condition) throw new AppError(status, message);
}
export function safeMessage(error: unknown) {
  return error instanceof AppError
    ? error.message
    : "The operation could not complete. Check configuration or contact an administrator.";
}
export async function attempt<T>(
  work: () => Promise<T>,
): Promise<{ data: T; error: null } | { data: null; error: AppError }> {
  try {
    return { data: await work(), error: null };
  } catch (error) {
    if (error instanceof AppError) return { data: null, error };
    throw error;
  }
}
