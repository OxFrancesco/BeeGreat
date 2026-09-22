export function redirectLegacyStocks({ request }: { request: Request }) {
  const url = new URL(request.url);
  url.pathname = url.pathname.slice("/aero".length);
  return new Response(null, { status: 308, headers: { Location: url.href } });
}
