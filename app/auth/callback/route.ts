import { createServerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (cookies) => {
            for (const { name, value, options } of cookies) {
              cookieStore.set(name, value, options);
            }
          },
        },
      }
    );
    await supabase.auth.exchangeCodeForSession(code);
  }

  let userId = "";
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (cookies) => {
            for (const { name, value, options } of cookies) {
              cookieStore.set(name, value, options);
            }
          },
        },
      }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (user) userId = user.id;
  } catch { /* ignore */ }

  const redirectUrl = new URL("/dashboard", request.url);
  if (userId) redirectUrl.searchParams.set("uid", userId);
  return NextResponse.redirect(redirectUrl);
}
