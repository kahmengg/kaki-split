# Kaki Split Security Audit

Last reviewed: 22 June 2026

## Scope

This pass reviewed the Supabase schema/RLS policies, privileged Vercel API routes, account deletion, client error logging, and launch-sensitive data surfaces.

## Fixed In This Pass

- Added database amount constraints for expenses, splits, and payments.
- Tightened RLS inserts so expenses, splits, payments, and nudges cannot reference users outside the target group.
- Added lightweight client error logging to Vercel function logs with token/email/cookie fields filtered out.
- Added a React error boundary so runtime crashes show a recoverable screen instead of a blank app.

## Current Security Posture

- Supabase service role is only used in serverless API routes and is not exposed to the client bundle.
- Destructive group/activity/account operations verify the caller from the bearer token before using service-role operations.
- RLS is enabled for app tables and storage objects.
- Account deletion removes the auth user and anonymizes profile data while preserving historical group references.
- Avatar storage is public-read by design, but writes are restricted to each user's own folder.

## Accepted Risks

- Group members can see other group members' profile fields returned by the app, including saved PayNow details. This is needed for settlement, but the app should avoid showing emails unnecessarily.
- Telegram outbox rows can be inserted by group members so expense/payment notifications can be queued from the client. If abuse appears, move all outbox writes behind server-side endpoints.
- Client error logs are intentionally lightweight. For production-scale monitoring, add Sentry or another dedicated error monitoring service with release/environment tags.

## Pre-Launch Checklist

- Confirm Vercel environment variables do not expose service-role keys to the browser.
- Confirm Supabase Auth allowed redirect URLs include production web and Android callback URLs.
- Confirm `supabase-schema.sql` has been rerun in production after this audit.
- Test RLS with two real accounts before inviting public users.
- Review Google Play Data Safety answers against the final feature set.
