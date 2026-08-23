# Environment Reference

Current exact shape:

```env
CF_ACCOUNT_ID=1003dc1d93af0ebea56b2f1252f89627
CF_API_TOKEN=

CF_ACCESS_KEY_ID=b6246d06e44d825f8558f7e41036432e
CF_SECRET_ACCESS_KEY=
CF_S3_API_ENDPOINT=https://1003dc1d93af0ebea56b2f1252f89627.r2.cloudflarestorage.com

RESEND_API_KEY=
RESEND_WEBHOOK_ID=
RESEND_WEBHOOK_SIGNING_SECRET=

MINIMAX_API_KEY=

APP_BASE_URL=https://club.loftwah.com
RESEND_FROM=
OPERATOR_EMAIL=
```

The user reports the real local environment has these blank values filled.

Do not print secrets during setup or acceptance reports.

## Variable purposes

- `CF_ACCOUNT_ID`: Cloudflare account identifier; known value above.
- `CF_API_TOKEN`: Cloudflare API token for local/deployment/management tooling where required.
- `CF_ACCESS_KEY_ID`: R2 S3-compatible key ID; known value above.
- `CF_SECRET_ACCESS_KEY`: matching R2 secret supplied by Cloudflare. Do not replace with a self-generated random string.
- `CF_S3_API_ENDPOINT`: known R2 S3 endpoint above.
- `RESEND_API_KEY`: existing full-access Resend API key.
- `RESEND_WEBHOOK_ID`: Resend webhook object ID.
- `RESEND_WEBHOOK_SIGNING_SECRET`: Resend returned `signing_secret` (`whsec_...`) used to verify webhook signatures.
- `MINIMAX_API_KEY`: MiniMax API key, usable by local agents and bounded runtime AI where enabled.
- `APP_BASE_URL`: canonical public URL required by background work that has no incoming request origin.
- `RESEND_FROM`: verified sender address/string.
- `OPERATOR_EMAIL`: human operator inbox for tasks and escalations.

## Resend webhook

Endpoint:

```text
POST https://club.loftwah.com/api/webhooks/resend
```

Initial event:

```text
email.received
```

The project currently reports `RESEND_WEBHOOK_ID` and `RESEND_WEBHOOK_SIGNING_SECRET` already exist. An implementation agent must not blindly create a duplicate webhook.

## Runtime injection

Do not assume every local value is injected into the Worker.

Cloudflare deployment/R2 S3 credentials may be tooling-only. D1/R2/Queues inside Workers should normally use bindings. Resend/MiniMax keys are Worker runtime secrets only where the deployed application actually calls those providers.

Do not add `APP_ENV`.
