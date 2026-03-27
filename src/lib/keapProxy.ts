export type KeapProxyConfig = {
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  path: string;
  requiredParams?: string[];
  pathParams?: string[];
};

const DEFAULT_KEAP_BASE = 'https://api.infusionsoft.com/crm/rest';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS,PATCH,DELETE,POST,PUT',
  'Access-Control-Allow-Headers':
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, X-Lobe-Trace, X-Lobe-Plugin-Settings, X-Lobe-Chat-Auth, Authorization',
};

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...corsHeaders },
  });

const parseSettings = (req: Request): Record<string, unknown> => {
  const raw = req.headers.get('x-lobe-plugin-settings');
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const getAccessToken = (settings: Record<string, unknown>): string | undefined => {
  const token =
    (typeof settings.access_token === 'string' && settings.access_token) ||
    (typeof settings.accessToken === 'string' && settings.accessToken);
  return token || undefined;
};

const expectedAccessToken = (): string | undefined => process.env.PLUGIN_ACCESS_TOKEN;

const getKeapToken = (): string | undefined =>
  process.env.KEAP_ACCESS_TOKEN || process.env.KEAP_PAT || process.env.KEAP_SAK || undefined;

const getKeapBaseUrl = (): string => process.env.KEAP_BASE_URL || DEFAULT_KEAP_BASE;

const appendParams = (params: URLSearchParams, data: Record<string, unknown>) => {
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) continue;
    if (typeof value === 'object') {
      params.set(key, JSON.stringify(value));
      continue;
    }
    params.set(key, String(value));
  }
};

const extractObject = (value: unknown): Record<string, unknown> | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
};

export const handleKeapProxy = async (req: Request, config: KeapProxyConfig) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse(405, { error: '[keap] only allow POST method' });
  }

  let args: Record<string, unknown> = {};
  const raw = await req.text();
  if (raw && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return jsonResponse(400, { error: 'Invalid JSON body. Expected object.' });
      }
      args = parsed as Record<string, unknown>;
      if (
        '_requestBody' in args &&
        args._requestBody &&
        typeof args._requestBody === 'object' &&
        !Array.isArray(args._requestBody)
      ) {
        args = args._requestBody as Record<string, unknown>;
      }
    } catch {
      return jsonResponse(400, { error: 'Invalid JSON body' });
    }
  }

  const required = config.requiredParams || [];
  for (const key of required) {
    if (!(key in args)) {
      return jsonResponse(400, { error: `Missing required parameter: ${key}` });
    }
  }

  const settings = parseSettings(req);
  const accessToken = getAccessToken(settings);
  if (!accessToken) {
    return jsonResponse(401, { error: 'Missing access token. Set access_token in plugin settings.' });
  }
  const expectedToken = expectedAccessToken();
  if (!expectedToken) {
    return jsonResponse(500, { error: 'Missing PLUGIN_ACCESS_TOKEN on server. Set it in the server environment.' });
  }
  if (accessToken !== expectedToken) {
    return jsonResponse(403, { error: 'Invalid access token.' });
  }

  const keapToken = getKeapToken();
  if (!keapToken) {
    return jsonResponse(500, {
      error: 'Missing Keap token on server. Set KEAP_ACCESS_TOKEN/KEAP_PAT/KEAP_SAK in the server environment.',
    });
  }

  let path = config.path;
  const pathParams = config.pathParams || [];
  for (const key of pathParams) {
    if (!(key in args)) {
      return jsonResponse(400, { error: `Missing required path parameter: ${key}` });
    }
    const value = encodeURIComponent(String(args[key]));
    path = path.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
    delete args[key];
  }

  const baseUrl = getKeapBaseUrl();
  const url = new URL(`${baseUrl}${path}`);
  const headers = new Headers();
  headers.set('Authorization', `Bearer ${keapToken}`);
  headers.set('Accept', 'application/json');

  const explicitQuery = extractObject(args._query) || extractObject(args.query);
  const explicitBody =
    extractObject(args._body) || extractObject(args.body) || extractObject(args._requestBody);

  if (explicitQuery) {
    delete args._query;
    delete args.query;
  }
  if (explicitBody) {
    delete args._body;
    delete args.body;
    delete args._requestBody;
  }

  let body: string | undefined;
  if (config.method === 'GET' || config.method === 'DELETE') {
    const params = new URLSearchParams();
    appendParams(params, explicitQuery || args);
    url.search = params.toString();
  } else {
    headers.set('content-type', 'application/json');
    body = JSON.stringify(explicitBody || args);
  }

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: config.method,
      headers,
      body,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return jsonResponse(502, {
      error: 'Keap fetch failed',
      message,
      url: url.toString(),
      hint: 'Check network connectivity, DNS/firewall rules, and Keap API availability.',
    });
  }

  const respHeaders = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders)) {
    respHeaders.set(key, value);
  }

  if (!response.ok) {
    let errorBody: unknown = null;
    const contentType = response.headers.get('content-type') || '';
    try {
      if (contentType.includes('application/json')) {
        errorBody = await response.json();
      } else {
        errorBody = await response.text();
      }
    } catch {
      errorBody = null;
    }

    return jsonResponse(response.status, {
      error: 'Keap API error',
      status: response.status,
      url: url.toString(),
      body: errorBody,
    });
  }

  return new Response(response.body, { status: response.status, headers: respHeaders });
};
