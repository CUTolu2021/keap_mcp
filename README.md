# Keap MCP (LobeChat Plugin)

Keap MCP is a LobeChat plugin that proxies the Keap API v2 through a controlled gateway. It requires an access token for plugin users and uses a Keap PAT/SAK stored on the server.

## Features
- Full Keap v2 coverage for: Campaign, Company, Contact, Email, Email Address, Note, Opportunity, Tags, Task, User Groups, Users, Webforms, Orders, Products, Files
- Auto-generated tool list from `KeapV2.json`
- Supports GET/POST/PATCH/PUT/DELETE with path params and query/body helpers

## Production URLs
- Manifest: https://keap.4spotconsulting.com/manifest.json
- OpenAPI: https://keap.4spotconsulting.com/openapi.json
- Gateway: https://keap.4spotconsulting.com/api/gateway

Update these to match your deployed domain.

## Required Environment Variables
Set these on the server hosting the plugin:
- KEAP_ACCESS_TOKEN=your-pat-or-sak
- KEAP_BASE_URL=https://api.infusionsoft.com/crm/rest
- PLUGIN_ACCESS_TOKEN=your-access-token

## Plugin Settings (LobeChat)
When installing the plugin, provide:
- access_token: your-access-token

The Keap token is read from the server env and is not entered in the plugin UI.

## Notes
- This plugin uses Keap v2 endpoints with `/v2/...` paths, and the base URL includes `/crm/rest`.
- The v2 spec does not include Appointments or Transactions; those endpoints are not exposed here.
- If an endpoint requires query parameters for POST/PATCH/PUT, pass them via `_query` and the body via `_body`.

## Local Development
```bash
npm install
npm run dev
```

The dev manifest is available at http://localhost:3400/manifest-dev.json
