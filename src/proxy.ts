import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseEnv } from '@/lib/supabase/env';

const PROTECTED_PREFIXES = ['/admin', '/pos', '/receipts'];

// Rafraîchit la session Supabase à chaque requête et renvoie vers /login les
// visiteurs non connectés. Les rôles et permissions sont vérifiés ensuite côté
// serveur, page par page et action par action (et par RLS en base).
export async function proxy(request: NextRequest) {
  const env = getSupabaseEnv();
  const { pathname } = request.nextUrl;

  if (!env) {
    if (pathname === '/configuration') return NextResponse.next();
    return NextResponse.redirect(new URL('/configuration', request.url));
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });

  // Ne rien intercaler entre la création du client et getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    url.searchParams.set('next', pathname);
    const redirect = NextResponse.redirect(url);
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:png|jpg|jpeg|webp|svg|ico)$).*)'],
};
