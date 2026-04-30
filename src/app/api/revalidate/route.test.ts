import { describe, it, expect, vi, beforeEach } from "vitest";
import { revalidateTag, revalidatePath } from "next/cache";
import { POST } from "./route";

beforeEach(() => {
  delete process.env.REVALIDATION_SECRET;
  vi.mocked(revalidateTag).mockClear();
  vi.mocked(revalidatePath).mockClear();
});

function postWithSecret(secret: string) {
  return POST(
    new Request("http://test/api/revalidate", {
      method: "POST",
      headers: { "x-revalidate-secret": secret },
    }),
  );
}

describe("POST /api/revalidate", () => {
  it("401 no REVALIDATION_SECRET env", async () => {
    delete process.env.REVALIDATION_SECRET;
    const res = await postWithSecret("abc");
    expect(res.status).toBe(401);
  });

  it("401 length mismatch", async () => {
    process.env.REVALIDATION_SECRET = "longsecret";
    const res = await postWithSecret("short");
    expect(res.status).toBe(401);
  });

  it("401 wrong bytes (same length)", async () => {
    process.env.REVALIDATION_SECRET = "abc";
    const res = await postWithSecret("xyz");
    expect(res.status).toBe(401);
  });

  it("200 correct secret", async () => {
    process.env.REVALIDATION_SECRET = "mysecret";
    const res = await postWithSecret("mysecret");
    expect(res.status).toBe(200);
    expect(vi.mocked(revalidateTag)).toHaveBeenCalledOnce();
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledOnce();
  });
});
