import { strict as assert } from "node:assert";
import { stableBucket } from "./dispatch_split.ts";

assert.equal(stableBucket("tech-100"), "control");
assert.equal(stableBucket("tech-101"), "dispatch-photo-follow-up");
assert.equal(stableBucket("tech-101"), stableBucket("tech-101"));
console.log("stable bucket decision: tech-100=control, tech-101=dispatch-photo-follow-up");
