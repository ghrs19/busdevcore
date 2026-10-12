import { test } from "node:test";
import assert from "node:assert/strict";
import { requestFingerprint } from "./estimate-idempotency.ts";

test("same body stable fingerprint", () => { assert.equal(requestFingerprint({a:1,b:2}), requestFingerprint({b:2,a:1})); });
test("different body differs", () => { assert.notEqual(requestFingerprint({a:1}), requestFingerprint({a:2})); });
