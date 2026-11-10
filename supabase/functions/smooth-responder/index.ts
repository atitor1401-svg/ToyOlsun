// Edge Function "smooth-responder" (named delete-account in the dashboard).
// Deletes the signed-in user: their services + images, then the auth user.
// For Sign in with Apple users the app also sends a fresh Apple authorization
// code; we trade it for a refresh token and revoke it, as Apple requires when
// an account is deleted (App Store guideline 5.1.1(v)).
// Apple secrets (set in Supabase → Edge Functions → Secrets):
//   APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY (contents of the .p8 file)
// Without them the revoke step is skipped and deletion still works.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { importPKCS8, SignJWT } from "https://esm.sh/jose@5.9.6";

const APPLE_CLIENT_ID = "com.ibo96.ToyOlsun";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

async function revokeAppleToken(authorizationCode: string): Promise<string> {
  const teamId = Deno.env.get("APPLE_TEAM_ID");
  const keyId = Deno.env.get("APPLE_KEY_ID");
  const privateKey = Deno.env.get("APPLE_PRIVATE_KEY");
  if (!teamId || !keyId || !privateKey) return "skipped: apple secrets not set";

  // The secret may be pasted with or without the BEGIN/END lines, quotes,
  // literal "\n" or no line breaks at all; rebuild a clean PEM from the base64.
  const base64 = privateKey
    .replace(/\\n/g, "\n")
    .replace(/-----[A-Z ]+-----/g, "")
    .replace(/["'\s]/g, "");
  const pem = `-----BEGIN PRIVATE KEY-----\n${base64.match(/.{1,64}/g)?.join("\n")}\n-----END PRIVATE KEY-----`;
  const key = await importPKCS8(pem, "ES256");
  const clientSecret = await new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: keyId })
    .setIssuer(teamId)
    .setIssuedAt()
    .setExpirationTime("5m")
    .setAudience("https://appleid.apple.com")
    .setSubject(APPLE_CLIENT_ID)
    .sign(key);

  const tokenRes = await fetch("https://appleid.apple.com/auth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: APPLE_CLIENT_ID,
      client_secret: clientSecret,
      code: authorizationCode,
      grant_type: "authorization_code",
    }),
  });
  const tokens = await tokenRes.json();
  const token = tokens.refresh_token ?? tokens.access_token;
  if (!token) return `token exchange failed: ${tokens.error ?? tokenRes.status}`;

  const revokeRes = await fetch("https://appleid.apple.com/auth/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: APPLE_CLIENT_ID,
      client_secret: clientSecret,
      token,
      token_type_hint: tokens.refresh_token ? "refresh_token" : "access_token",
    }),
  });
  return revokeRes.ok ? "revoked" : `revoke failed: ${revokeRes.status}`;
}

Deno.serve(async (req) => {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization header" }, 401);

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !userData?.user) return json({ error: "Invalid or expired session" }, 401);

    const userId = userData.user.id;

    // Optional body: { appleAuthorizationCode } from the app (Apple users only).
    let appleAuthorizationCode: string | undefined;
    try {
      const body = await req.json();
      if (typeof body?.appleAuthorizationCode === "string") appleAuthorizationCode = body.appleAuthorizationCode;
    } catch { /* no body: older app versions */ }

    let appleRevoke: string | undefined;
    if (appleAuthorizationCode) {
      try {
        appleRevoke = await revokeAppleToken(appleAuthorizationCode);
      } catch (e) {
        appleRevoke = `error: ${String(e)}`;
      }
      // Never block the deletion because of Apple; the log shows what happened.
      console.log("apple revoke:", appleRevoke);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: services, error: servicesError } = await supabaseAdmin
      .from("service")
      .select("id, images")
      .eq("owner_id", userId);

    if (!servicesError && services) {
      const filePaths: string[] = [];
      const marker = "/object/public/images/";
      for (const svc of services) {
        const images: string[] = svc.images || [];
        for (const url of images) {
          const idx = url.indexOf(marker);
          if (idx !== -1) filePaths.push(url.slice(idx + marker.length));
        }
      }
      if (filePaths.length > 0) await supabaseAdmin.storage.from("images").remove(filePaths);
    }

    await supabaseAdmin.from("service").delete().eq("owner_id", userId);

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteError) return json({ error: deleteError.message }, 500);

    return json({ success: true, appleRevoke });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
