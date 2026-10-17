import { redirect } from 'next/navigation';

// The tree lives on the home page ("/"); this old URL is kept only so existing bookmarks
// (and the middleware matcher) still land somewhere useful. The component itself is
// src/components/tree/GenealogyTree.tsx - it must not live in a route file, because
// `next build` prerenders route files without props.
export default function GenealogyTreeRoute() {
  redirect('/');
}
