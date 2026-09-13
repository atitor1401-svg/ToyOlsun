import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Admin-only: sends a push notification to one or more users' saved
// push_tokens via Expo's push API. Callers must present the Supabase
// service_role key as a Bearer token — this is never shipped in the app,
// so only someone with dashboard/API access (the admin) can call it.
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authHeader = req.headers.get('Authorization') || '';
  const callerToken = authHeader.replace('Bearer ', '');
  if (!SERVICE_ROLE_KEY || callerToken !== SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { user_ids, all, title, body } = await req.json();

    if (!title || !body) {
      return new Response(JSON.stringify({ error: 'title and body are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!all && (!Array.isArray(user_ids) || user_ids.length === 0)) {
      return new Response(JSON.stringify({ error: 'user_ids (array) is required unless all=true' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, SERVICE_ROLE_KEY);

    let query = supabaseAdmin.from('push_tokens').select('token');
    if (!all) query = query.in('user_id', user_ids);
    const { data: tokenRows, error } = await query;
    if (error) throw error;

    const tokens = [...new Set((tokenRows || []).map((r: { token: string }) => r.token))];
    if (tokens.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: 'No matching push tokens found' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Expo's push API accepts up to 100 messages per request.
    const chunks: string[][] = [];
    for (let i = 0; i < tokens.length; i += 100) chunks.push(tokens.slice(i, i + 100));

    const results = [];
    for (const chunk of chunks) {
      const messages = chunk.map((to) => ({ to, title, body, sound: 'default' }));
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(messages),
      });
      results.push(await res.json());
    }

    return new Response(JSON.stringify({ sent: tokens.length, results }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
