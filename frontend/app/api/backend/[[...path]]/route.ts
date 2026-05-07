import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const DEFAULT_GATEWAY = "http://127.0.0.1:4000";

function gatewayBase(): string {
  const raw =
    process.env.API_GATEWAY_INTERNAL_URL?.trim() || DEFAULT_GATEWAY;
  return raw.replace(/\/$/, "");
}

type RouteParams = { params: Promise<{ path?: string[] }> };

async function proxy(request: NextRequest, segmentPath: string) {
  const gateway = gatewayBase();
  const u = new URL(request.url);
  const targetUrl = `${gateway}/${segmentPath}${u.search}`;

  let body: ArrayBuffer | undefined;
  if (request.method !== "GET" && request.method !== "HEAD") {
    body = await request.arrayBuffer();
  }

  try {
    const upstream = await fetch(targetUrl, {
      method: request.method,
      headers: {
        accept: request.headers.get("accept") ?? "application/json",
        ...(body && body.byteLength > 0
          ? {
              "content-type":
                request.headers.get("content-type") ?? "application/json",
            }
          : {}),
      },
      body:
        body && body.byteLength > 0 ? new Uint8Array(body) : undefined,
      cache: "no-store",
    });

    const text = await upstream.text();
    const ct =
      upstream.headers.get("content-type") ?? "application/json; charset=utf-8";

    return new NextResponse(text, {
      status: upstream.status,
      headers: {
        "content-type": ct,
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
        "access-control-allow-headers": "Content-Type, Accept",
      },
    });
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      {
        ok: false,
        error: "gateway_unreachable",
        message:
          `Impossibile raggiungere l'api-gateway (${gateway}). ` +
          `Avvia il servizio sulla porta prevista (di solito 4000) e riprova. ` +
          `Dettaglio tecnico: ${detail}`,
      },
      {
        status: 502,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "access-control-allow-origin": "*",
        },
      },
    );
  }
}

async function segmentFromParams(ctx: RouteParams): Promise<string> {
  const p = await ctx.params;
  const parts = p.path;
  if (!parts?.length) return "";
  return parts.join("/");
}

export async function GET(request: NextRequest, ctx: RouteParams) {
  return proxy(request, await segmentFromParams(ctx));
}

export async function POST(request: NextRequest, ctx: RouteParams) {
  return proxy(request, await segmentFromParams(ctx));
}

export async function DELETE(request: NextRequest, ctx: RouteParams) {
  return proxy(request, await segmentFromParams(ctx));
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
      "access-control-allow-headers": "Content-Type, Accept",
    },
  });
}
