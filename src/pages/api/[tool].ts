import { keapEndpoints } from '@/lib/keapEndpoints';
import { handleKeapProxy } from '@/lib/keapProxy';

export const config = {
  runtime: 'edge',
};

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });

export default async (req: Request) => {
  const pathname = new URL(req.url).pathname;
  const parts = pathname.split('/');
  const tool = parts[parts.length - 1] || '';

  const endpoint = keapEndpoints[tool];
  if (!endpoint) {
    return jsonResponse(404, { error: `Unknown keap tool: ${tool}` });
  }

  return handleKeapProxy(req, endpoint);
};
