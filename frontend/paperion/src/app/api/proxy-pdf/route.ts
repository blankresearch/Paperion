import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const src = req.nextUrl.searchParams.get("url");
  if (!src) return new Response("Missing url", { status: 400 });

  const upstream = await fetch(src.replace(/#.*$/, ""), {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  if (!upstream.ok) return new Response("Upstream error", { status: upstream.status });

  const ct = upstream.headers.get("content-type") ?? "application/pdf";
  return new Response(upstream.body, {
    headers: {
      "Content-Type": ct,
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
