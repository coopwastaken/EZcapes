// EZCAPES Premium Code Validation Worker
// Cloudflare Worker + KV for single-use unlock codes

export default {
  async fetch(request, env) {
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    // POST /validate — check and redeem a code
    if (url.pathname === '/validate' && request.method === 'POST') {
      try {
        const { code } = await request.json();
        if (!code) {
          return Response.json({ valid: false, error: 'No code provided' }, { headers: corsHeaders });
        }

        const cleanCode = code.trim().toUpperCase();

        // Check if code exists in KV
        const codeData = await env.EZCAPES_CODES.get(cleanCode, 'json');

        if (!codeData) {
          return Response.json({ valid: false, error: 'Invalid code' }, { headers: corsHeaders });
        }

        if (codeData.used) {
          return Response.json({ valid: false, error: 'Code already used' }, { headers: corsHeaders });
        }

        // Mark as used
        codeData.used = true;
        codeData.usedAt = new Date().toISOString();
        await env.EZCAPES_CODES.put(cleanCode, JSON.stringify(codeData));

        return Response.json({ valid: true, message: 'Premium unlocked!' }, { headers: corsHeaders });
      } catch (e) {
        return Response.json({ valid: false, error: 'Server error' }, { headers: corsHeaders, status: 500 });
      }
    }

    // POST /generate — admin endpoint to create new codes (protected by secret)
    if (url.pathname === '/generate' && request.method === 'POST') {
      try {
        const { secret, count } = await request.json();
        if (secret !== env.ADMIN_SECRET) {
          return Response.json({ error: 'Unauthorized' }, { headers: corsHeaders, status: 401 });
        }

        const codes = [];
        const num = count || 1;
        for (let i = 0; i < num; i++) {
          const code = 'EZCAPES-' + randomSegment() + '-' + randomSegment();
          await env.EZCAPES_CODES.put(code, JSON.stringify({ created: new Date().toISOString(), used: false }));
          codes.push(code);
        }

        return Response.json({ codes }, { headers: corsHeaders });
      } catch (e) {
        return Response.json({ error: 'Server error' }, { headers: corsHeaders, status: 500 });
      }
    }

    // POST /webhook/kofi — Ko-fi webhook (auto-generate code on donation)
    if (url.pathname === '/webhook/kofi' && request.method === 'POST') {
      try {
        const formData = await request.formData();
        const dataStr = formData.get('data');
        if (!dataStr) return new Response('OK', { status: 200 });

        const data = JSON.parse(dataStr);
        const email = data.email;
        const name = data.from_name;

        // Generate a unique code
        const code = 'EZCAPES-' + randomSegment() + '-' + randomSegment();
        await env.EZCAPES_CODES.put(code, JSON.stringify({
          created: new Date().toISOString(),
          used: false,
          donor: name,
          email: email
        }));

        // Store the code associated with the email so we can look it up
        // Ko-fi doesn't support sending back responses, so the code needs to be delivered separately
        // For now, store it and you can check manually or set up email later
        await env.EZCAPES_CODES.put('donor:' + email, code);

        return new Response('OK', { status: 200 });
      } catch (e) {
        return new Response('Error', { status: 500 });
      }
    }

    // GET /check-donor — look up code by donor email (admin use)
    if (url.pathname === '/check-donor' && request.method === 'POST') {
      try {
        const { secret, email } = await request.json();
        if (secret !== env.ADMIN_SECRET) {
          return Response.json({ error: 'Unauthorized' }, { headers: corsHeaders, status: 401 });
        }
        const code = await env.EZCAPES_CODES.get('donor:' + email);
        return Response.json({ code: code || null }, { headers: corsHeaders });
      } catch (e) {
        return Response.json({ error: 'Server error' }, { headers: corsHeaders, status: 500 });
      }
    }

    return Response.json({ error: 'Not found' }, { headers: corsHeaders, status: 404 });
  }
};

function randomSegment() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 4; i++) result += chars[Math.floor(Math.random() * chars.length)];
  return result;
}
