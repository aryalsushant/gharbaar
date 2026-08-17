#!/usr/bin/env bash
# Creates the Supabase project, applies the migration, and writes .env.
#
# Needs SUPABASE_ACCESS_TOKEN in the environment (Account -> Access Tokens on
# supabase.com). The token is never written to disk. The generated database
# password is written only to .env, which is gitignored.
#
#   export SUPABASE_ACCESS_TOKEN=sbp_...
#   ./scripts/setup-supabase.sh [project-name] [region]

set -euo pipefail

PROJECT_NAME="${1:-gharbaar}"
REGION="${2:-us-east-1}"

if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "SUPABASE_ACCESS_TOKEN is not set. Export it and re-run." >&2
  exit 1
fi

# The CLI has accepted both --output json and --output-format json across
# versions, so ask for JSON one way and fall back to the other.
sb_json() {
  local out
  if out="$(npx --no-install supabase "$@" --output json 2>/dev/null)" \
     && node -e 'JSON.parse(require("fs").readFileSync(0,"utf8"))' <<<"$out" 2>/dev/null; then
    printf '%s' "$out"
    return 0
  fi
  npx --no-install supabase "$@" --output-format json
}

pick() { node -e "$1"; }

echo "==> Finding your organization"
ORG_ID="$(sb_json orgs list | pick '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
  const o=JSON.parse(s);
  if(!o.length){console.error("No organizations on this account.");process.exit(1)}
  process.stdout.write(o[0].id);
})')"
echo "    org: $ORG_ID"

echo "==> Creating project '$PROJECT_NAME' in $REGION"
DB_PASSWORD="$(node -e 'process.stdout.write(require("crypto").randomBytes(24).toString("base64url"))')"
PROJECT_REF="$(sb_json projects create "$PROJECT_NAME" \
  --org-id "$ORG_ID" --db-password "$DB_PASSWORD" --region "$REGION" | pick '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
  const p=JSON.parse(s);
  process.stdout.write(p.id||p.ref||p.project_ref);
})')"
echo "    ref: $PROJECT_REF"

echo "==> Waiting for the project to come up (a couple of minutes)"
for _ in $(seq 1 60); do
  STATUS="$(sb_json projects list | pick "
let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{
  const p=JSON.parse(s).find(x=>(x.id||x.ref)==='$PROJECT_REF');
  process.stdout.write(p?(p.status||'UNKNOWN'):'UNKNOWN');
})")"
  echo "    status: $STATUS"
  [[ "$STATUS" == "ACTIVE_HEALTHY" ]] && break
  sleep 10
done

echo "==> Linking this repo to the project"
npx --no-install supabase link --project-ref "$PROJECT_REF" --password "$DB_PASSWORD"

echo "==> Applying the migration"
npx --no-install supabase db push --password "$DB_PASSWORD"

echo "==> Writing .env"
# Supabase issues both the legacy "anon" JWT and newer publishable keys;
# either works as the client-side key, so accept whichever is present.
ANON_KEY="$(sb_json projects api-keys --project-ref "$PROJECT_REF" | pick '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
  const keys=JSON.parse(s);
  const hit=keys.find(k=>k.name==="anon")
    || keys.find(k=>String(k.name||"").includes("publishable"))
    || keys.find(k=>String(k.api_key||"").startsWith("sb_publishable_"));
  if(!hit){console.error("Could not find a client key in: "+JSON.stringify(keys));process.exit(1)}
  process.stdout.write(hit.api_key||hit.apiKey);
})')"

cat > .env <<EOF
EXPO_PUBLIC_SUPABASE_URL=https://$PROJECT_REF.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY
EOF

echo
echo "Done. Project $PROJECT_REF is linked and migrated, and .env is written."
echo "Database password (saved nowhere else): $DB_PASSWORD"
echo "Now run: npx expo start"
