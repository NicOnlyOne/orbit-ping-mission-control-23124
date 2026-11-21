# Modernize and optimize OrbitPing

## Scope
Improve speed, reliability, and maintainability without changing the visual design, pricing, beta restrictions, permissions, or monitoring behavior.

## Changes
- Create shared, typed plan definitions for pricing, limits, labels, and feature access; use them in the landing page, pricing dialog, subscription provider, and admin views.
- Modernize authentication and subscription providers with typed errors, stable callbacks, memoized context values, parallel data requests, and protection against stale responses.
- Refactor monitor management to use stable callbacks, normalized data helpers, cleaned-up timeouts, debounced realtime refreshes, and monitoring timers that do not restart on every status change.
- Optimize admin and analytics screens by memoizing filtering/aggregates, moving static configuration out of renders, and running independent analytics queries in parallel.
- Replace explicit `any` usage, deprecated keyboard handlers, and TypeScript suppression comments in affected code; resolve existing lint errors where practical without redesigning generated UI components.
- Add focused tests for shared plan rules and monitor helpers.

## Verification
- Run TypeScript, lint, and focused tests.
- Check the preview build log.
- Exercise the landing page and signed-in monitor flow in the browser, including creating and testing a monitor when a test session is available.
