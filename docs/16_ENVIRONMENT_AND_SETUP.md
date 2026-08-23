# 17. Environment and Secrets

Current local environment shape:

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

The real local environment is reported to have the blanks filled.

Do not print secrets in logs.

### Cloudflare variables

`CF_ACCOUNT_ID`: known account ID.

`CF_API_TOKEN`: Cloudflare API token used by local tooling/management where required.

`CF_ACCESS_KEY_ID` / `CF_SECRET_ACCESS_KEY`: R2 S3-compatible credentials for external/local S3-compatible access where required. The secret is supplied by Cloudflare; do not replace it with a random generated value.

`CF_S3_API_ENDPOINT`: known endpoint above.

### Resend

`RESEND_API_KEY`: existing full-access API key.

`RESEND_WEBHOOK_ID`: webhook object identifier returned by Resend.

`RESEND_WEBHOOK_SIGNING_SECRET`: Resend `signing_secret`, `whsec_...`, used for webhook verification.

`RESEND_FROM`: verified sender.

`OPERATOR_EMAIL`: human operator inbox.

### MiniMax

`MINIMAX_API_KEY`: used by local agent tooling and, if enabled, bounded runtime generation.

### App URL

`APP_BASE_URL=https://club.loftwah.com`.

Do not add `APP_ENV`.

Do not assume every local variable is injected into Worker runtime. D1/R2/Queues use bindings. Tooling credentials may remain tooling-only.

---
