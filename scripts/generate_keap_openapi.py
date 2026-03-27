import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC_PATH = ROOT / "KeapV2.json"

ALLOWED_TAGS = {
    "Campaign",
    "Company",
    "Contact",
    "Email",
    "Email Address",
    "Note",
    "Opportunity",
    "Tags",
    "Task",
    "User Groups",
    "Users",
    "Webforms",
    "Orders",
    "Products",
    "Files",
}

EXTRA_PATH_CONTAINS = [
    "/opportunities/stages",
]


def to_snake(name: str) -> str:
    s1 = re.sub(r"(.)([A-Z][a-z]+)", r"\1_\2", name)
    s2 = re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", s1)
    s3 = s2.replace("-", "_").replace("__", "_")
    return s3.lower()


def main() -> None:
    spec = json.loads(SPEC_PATH.read_text(encoding="utf-8"))
    endpoints = []

    for path, methods in spec.get("paths", {}).items():
        for method, op in methods.items():
            if method.lower() not in {"get", "post", "put", "patch", "delete"}:
                continue

            tags = op.get("tags") or []
            include = any(tag in ALLOWED_TAGS for tag in tags)

            if not include:
                lower_path = path.lower()
                if any(token in lower_path for token in EXTRA_PATH_CONTAINS):
                    include = True

            if not include:
                continue

            op_id = op.get("operationId")
            if not op_id:
                continue

            tool_name = f"keap_{to_snake(op_id)}"

            path_params = []
            for param in op.get("parameters", []):
                if param.get("in") == "path" and "name" in param:
                    path_params.append(param["name"])

            normalized_path = path
            if normalized_path.startswith("/rest/"):
                normalized_path = normalized_path[len("/rest") :]
            elif normalized_path.startswith("/rest"):
                normalized_path = normalized_path.replace("/rest", "", 1)

            endpoints.append(
                {
                    "name": tool_name,
                    "method": method.upper(),
                    "path": normalized_path,
                    "pathParams": path_params,
                    "summary": op.get("summary") or op_id,
                    "description": op.get("description") or "",
                }
            )

    # de-dupe by name
    unique = {ep["name"]: ep for ep in endpoints}
    endpoints = sorted(unique.values(), key=lambda x: x["name"])

    # write keapEndpoints.ts
    keap_endpoints_path = ROOT / "src" / "lib" / "keapEndpoints.ts"
    lines = [
        "export type KeapEndpoint = {",
        "  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';",
        "  path: string;",
        "  pathParams?: string[];",
        "};",
        "",
        "export const keapEndpoints: Record<string, KeapEndpoint> = {",
    ]
    for ep in endpoints:
        entry = f"  '{ep['name']}': {{ method: '{ep['method']}', path: '{ep['path']}'"
        if ep["pathParams"]:
            entry += f", pathParams: {json.dumps(ep['pathParams'])}"
        entry += " },"
        lines.append(entry)
    lines.append("};")
    keap_endpoints_path.write_text("\n".join(lines) + "\n", encoding="utf-8")

    # write openapi.json
    openapi = {
        "openapi": "3.0.0",
        "info": {
            "title": "Keap MCP API",
            "version": "1.0.0",
            "description": "LobeChat plugin endpoints that proxy Keap API v2 using PAT/SAK.",
        },
        "servers": [{"url": "https://keap.4spotconsulting.com"}],
        "paths": {},
    }

    for ep in endpoints:
        openapi["paths"][f"/api/{ep['name']}"] = {
            "post": {
                "operationId": ep["name"],
                "summary": ep["summary"],
                "description": ep["description"],
                "requestBody": {
                    "content": {
                        "application/json": {
                            "schema": {"type": "object", "additionalProperties": True}
                        }
                    }
                },
                "responses": {"200": {"description": "OK"}},
            }
        }

    openapi_path = ROOT / "public" / "openapi.json"
    openapi_path.write_text(json.dumps(openapi, indent=2) + "\n", encoding="utf-8")

    print(f"Generated {len(endpoints)} endpoints")


if __name__ == "__main__":
    main()
