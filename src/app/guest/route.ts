import { DEMO_TREE_SLUG, treeSlugSetCookie } from '@/lib/auth/tree';

// /guest: the link for showing the product to outsiders. It points this browser at the fake demo family (same cookie
// as /t/<slug>), then goes to the home page. Someone already signed in still sees their own family: a session beats the cookie.
export async function GET() {
  const headers = new Headers({ Location: '/' }); // relative on purpose: behind a proxy the request's own origin is not the public one
  headers.append('Set-Cookie', treeSlugSetCookie(DEMO_TREE_SLUG));
  return new Response(null, { status: 307, headers });
}
