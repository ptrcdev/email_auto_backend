# WhatsApp Integration — Archived

## Why Archived
WhatsApp integration was deprioritized because:
1. **Meta Business Verification** is required for production access, which blocks deployment
2. The MVP can function with email digest + web-based priority setting
3. Calendar reminders and web push provide alternative notification channels

## What's Here
- `whatsapp.service.ts` — Meta Cloud API client for sending template messages and handling inbound messages
- `whatsapp.controller.ts` — Webhook verification and message handling
- `whatsapp.module.ts` — NestJS module wiring
- `whatsapp.service.spec.ts` — Unit tests
- `whatsapp.processor.ts` — BullMQ worker for sending priority prompts

## Env Vars (commented out in .env.example)
- `WHATSAPP_PHONE_NUMBER_ID` — Meta Cloud API phone number ID
- `WHATSAPP_TOKEN` — Meta Cloud API access token
- `WHATSAPP_VERIFY_TOKEN` — Webhook verification token
- `WHATSAPP_TEMPLATE_NAME` — Approved template name for priority prompts
- `WHATSAPP_TEMPLATE_LANG` — Template language code (default: en)

## To Re-Activate
1. Complete Meta Business Verification in Facebook Developer Dashboard
2. Uncomment env vars in `.env.example` and set values
3. Move files back to `src/whatsapp/` and `src/queue/workers/`
4. Restore imports in `app.module.ts`, `queue.module.ts`, `queue.service.ts`, `scheduler.service.ts`
5. Restore WhatsApp fields in `user.entity.ts` and `user.repository.ts`
6. Restore WhatsApp fields in `users.controller.ts` and `users.service.ts`
7. Create a WhatsApp template for priority prompts and get it approved
8. Set webhook URL in Meta Dashboard: `https://<your-app>/whatsapp/webhook`
