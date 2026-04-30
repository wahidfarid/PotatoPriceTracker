import { vi } from "vitest";

process.env.DATABASE_URL = "file:./prisma/dev.db";

vi.mock("next/cache", () => ({
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
}));
