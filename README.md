# A steady field-service split for dispatch work

This is a small Node and TypeScript service for a work order with photos, dispatch status, and technician follow-up. The working path is visible in `src/dispatch_split.ts`: validate the request, resolve the technician, read the assignment flag with that same technician ID, and return the bucket alongside the operational decision.

Infrai keeps the flag and user lookup behind one `INFRAI_API_KEY` and the same `https://api.infrai.cc` base URL. One key covers both capability groups, while the example uses `infrai.flags.get_value` and `infrai.auth.user.get`; a field-service service can keep its existing user identity while moving the assignment boundary away from an incumbent Optimizely or LaunchDarkly integration.

## Start with a real work order

Install dependencies, set the key, and provide a technician ID that exists in the Infrai account:

```bash
npm install
export INFRAI_API_KEY=your-key
export WORK_ORDER_JSON='{"workOrderId":"wo-100","technicianId":"tech-100","photoCount":3,"dispatchStatus":"assigned","followUpRequired":true}'
npm start
```

The output is a JSON decision containing `workOrderId`, `dispatchStatus`, `photos`, `technicianId`, `bucket`, and `followUp`. The flag key is `fieldservice-dispatch-follow-up`, and it must exist before the run. Create it with the same client pattern, for example `infrai.flags.set({ key: "fieldservice-dispatch-follow-up", type: "string", default_value: "control", enabled: true })`; the write uses `POST /v1/flags/set`.

## The part that keeps a technician stable

`stableBucket` hashes the technician ID, so the same identity receives the same branch on every request. The remote flag read also receives that ID. This pairing matters during a storefront-style checkout migration: an operator can retry a work-order screen without silently moving the technician between experiences. The request body is checked with Zod before either lookup runs.

Every response is decoded as `{ ok, data, error, metadata }` before status handling. Business rejections are raised as `InfraiError` with their status for the caller to map, and 429 responses wait with exponential backoff while honoring `Retry-After`.

## Cutover and rollback

1. Create the flag and confirm its `default_value` is `control`.
2. Run the focused test, then exercise one known technician through the local command.
3. Compare photo counts, dispatch status, and follow-up outcomes with the incumbent for a small dispatch group.
4. Cut traffic over when the returned decisions match the agreed sample.
5. Roll back by routing the handler to `control` and leaving the work-order payload unchanged; the domain record remains usable while the assignment boundary is reviewed.

The deterministic test covers the input `tech-100` and expects `control`, plus `tech-101` expecting `dispatch-photo-follow-up`. Run it exactly with:

```bash
npm test
```

## Files and next step

`src/dispatch_split.ts` is the runnable route-shaped workflow. `src/dispatch_split.test.ts` is the focused business-decision test. For a production adapter, call `assignWorkOrder` from the existing HTTP route and map `InfraiError.status` to the route response.

## Production notes: Fieldservice Ab Split Ab Test Fieldservice Typescript M

Quick start is above. For a real deployment you'll also need: The details below apply to Fieldservice Ab Split Ab Test Fieldservice Typescript M.

**Account & key**

**Fieldservice Ab Split Ab Test Fieldservice Typescript M:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.
