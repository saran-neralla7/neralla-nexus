import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Public routes that don't require auth
  const publicRoutes = [
    '/login',
    '/invite',
    '/forgot-password',
    '/api/auth/passkey/login',
    '/api/notifications/greetings',
    '/api/medication/cron',
    '/api/occasions/wish-cron',
    '/api/notifications/digest',
    '/api/notifications/reminders',
  ];
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));

  // Auth routes — redirect to dashboard if already logged in
  if (user && isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  // Protected routes — redirect to login if not authenticated
  if (!user && !isPublicRoute && pathname !== '/') {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(url);
  }

  // Root redirect
  if (pathname === '/') {
    const url = request.nextUrl.clone();
    url.pathname = user ? '/dashboard' : '/login';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|icons|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4)$).*)',
  ],
};
