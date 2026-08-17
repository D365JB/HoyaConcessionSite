declare module "cloudflare:node" {
  export function httpServerHandler(options: { port: number }): {
    fetch(request: Request, env: unknown, ctx: { waitUntil(promise: Promise<unknown>): void }): Promise<Response>;
  };
}
