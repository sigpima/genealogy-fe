import { TREE_SLUG_COOKIE, isValidTreeSlug } from '@/lib/auth/tree';

// /t/<slug>: the link a family shares. It remembers which family's tree this browser means (guests and
// signup need it when the site hosts several families), then goes to the home page. Whether the slug
// actually exists is the API's call - an unknown slug simply shows nothing there.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const headers = new Headers({ Location: '/' }); // relative on purpose: behind a proxy the request's own origin is not the public one
  if (isValidTreeSlug(slug)) {
    headers.append(
      'Set-Cookie',
      `${TREE_SLUG_COOKIE}=${slug}; Path=/; Max-Age=31536000; SameSite=Lax`,
    );
  }
  return new Response(null, { status: 307, headers });
}
