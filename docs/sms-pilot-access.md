# SMS Pilot Access

Pocketcode launches SMS execution as an invite-only pilot. Production deployments must set `SMS_ALLOWLIST` to a comma-separated list of E.164 phone numbers that may create execution jobs.

```txt
SMS_ALLOWLIST=+15555550123,+15555550124
```

To add a pilot user, append their E.164 phone number to `SMS_ALLOWLIST` and redeploy or update the Worker configuration. To remove access, delete the phone number from `SMS_ALLOWLIST`; future execution commands from that number will receive a refusal SMS and will not create sandbox jobs. Existing message and execution history remains in the database for audit and admin review.

Non-production environments permit execution when `SMS_ALLOWLIST` is unset so local webhook tests and demos can run without production pilot configuration. Production fails closed when `ENVIRONMENT=production` and `SMS_ALLOWLIST` is blank.

## Sandbox Network Risk

As of `@cloudflare/sandbox` 0.9, the SDK exposes sandbox lifecycle, timeout, transport, and command-isolation options, but not an option to disable outbound network access for code running inside the container. The launch policy therefore remains invite-only until Cloudflare exposes network-disabled execution or the project adds a separate enforcement layer.