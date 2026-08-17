import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { createContext } from "./_core/context";
import { LOCAL_ADMIN_COOKIE } from "./localAuth";

describe("bootstrap local admin credentials", () => {
  it("creates and authenticates the configured first administrator through the login procedure", async () => {
    const email = process.env.BOOTSTRAP_ADMIN_EMAIL;
    const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
    expect(email).toBeTruthy();
    expect(password).toBeTruthy();

    const cookies: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {}, cookies: {} } as TrpcContext["req"],
      res: {
        cookie: (name: string, value: string, options: Record<string, unknown>) => cookies.push({ name, value, options }),
      } as TrpcContext["res"],
    };

    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.login({ email: email!, password: password! });

    expect(result.role).toBe("admin");
    expect(result.email).toBe(email!.trim().toLowerCase());
    expect(cookies).toHaveLength(1);
    expect(cookies[0]?.name).toBe(LOCAL_ADMIN_COOKIE);
    expect(cookies[0]?.value).toBeTruthy();

    await expect(caller.auth.login({ email: email!, password: `${password}!` })).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    const restoredContext = await createContext({
      req: { protocol: "https", headers: { cookie: `${LOCAL_ADMIN_COOKIE}=${cookies[0]?.value}` } } as any,
      res: {} as any,
    });
    const restoredUser = await appRouter.createCaller(restoredContext).auth.me();
    expect(restoredUser?.email).toBe(email!.trim().toLowerCase());
    expect(restoredUser).not.toHaveProperty("passwordHash");
  });
});
