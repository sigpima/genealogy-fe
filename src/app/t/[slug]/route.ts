import { isValidTreeSlug, treeSlugSetCookie } from '@/lib/auth/tree';

// /t/<slug>: the link a family shares. It remembers which family's tree this browser means (guests and
// signup need it when the site hosts several families), then goes to the home page. Whether the slug
// actually exists is the API's call - an unknown slug simply shows nothing there.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const headers = new Headers({ Location: '/' }); // relative on purpose: behind a proxy the request's own origin is not the public one
  if (isValidTreeSlug(slug)) headers.append('Set-Cookie', treeSlugSetCookie(slug));
  return new Response(null, { status: 307, headers });
}
