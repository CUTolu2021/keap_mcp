export const config = {
  runtime: 'edge',
};

export default async (req: Request) => {
  const corsHeaders = {
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS,PATCH,DELETE,POST,PUT',
    'Access-Control-Allow-Headers':
      'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, X-Lobe-Trace, X-Lobe-Plugin-Settings, X-Lobe-Chat-Auth',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ body: { message: '[gateway] only allow POST method' }, errorType: 405 }), {
      status: 405,
      headers: { 'content-type': 'application/json', ...corsHeaders },
    });
  }

  const raw = await req.text();

  let payload: Record<string, unknown>;
  try {
    payload = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid gateway JSON body' }), {
      status: 400,
      headers: { 'content-type': 'application/json', ...corsHeaders },
    });
  }

  const apiName = payload.apiName;
  if (typeof apiName !== 'string' || !apiName) {
    return new Response(JSON.stringify({ error: 'Missing apiName' }), {
      status: 400,
      headers: { 'content-type': 'application/json', ...corsHeaders },
    });
  }

  const args = payload.arguments;
  let body = '{}';
  if (typeof args === 'string' && args.trim()) {
    body = args;
  } else if (args && typeof args === 'object') {
    body = JSON.stringify(args);
  }

  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };

  const settings = req.headers.get('x-lobe-plugin-settings');
  if (settings) headers['x-lobe-plugin-settings'] = settings;

  const response = await fetch(new URL(`/api/${apiName}`, req.url), {
    method: 'POST',
    headers,
    body,
  });

  const respHeaders = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders)) {
    respHeaders.set(key, value);
  }

  return new Response(response.body, { status: response.status, headers: respHeaders });
};
