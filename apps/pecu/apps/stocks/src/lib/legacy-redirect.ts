export function redirectLegacyStocks({ request }: { request: Request }) {
  const url = new URL(request.url);
  url.pathname = `/aero${url.pathname}`;
  return new Response(null, { status: 308, headers: { Location: url.href } });
}
