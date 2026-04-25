import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { actionPermission, canTransitionOrder } from "./order-helpers";

describe("canTransitionOrder", () => {
  it("draft allows submit and void", () => {
    assert.equal(canTransitionOrder("draft", "submit"), true);
    assert.equal(canTransitionOrder("draft", "void"), true);
    assert.equal(canTransitionOrder("draft", "approve"), false);
  });
  it("submitted allows approve and reject only", () => {
    assert.equal(canTransitionOrder("submitted", "approve"), true);
    assert.equal(canTransitionOrder("submitted", "reject"), true);
    assert.equal(canTransitionOrder("submitted", "void"), false);
    assert.equal(canTransitionOrder("submitted", "submit"), false);
  });
  it("rejected allows submit only", () => {
    assert.equal(canTransitionOrder("rejected", "submit"), true);
    assert.equal(canTransitionOrder("rejected", "void"), false);
  });
  it("approved allows reverse only", () => {
    assert.equal(canTransitionOrder("approved", "reverse"), true);
    assert.equal(canTransitionOrder("approved", "approve"), false);
  });
  it("voided allows nothing", () => {
    for (const a of ["submit", "approve", "reject", "void", "reverse"] as const) {
      assert.equal(canTransitionOrder("voided", a), false);
    }
  });
  it("unknown status is conservative", () => {
    assert.equal(canTransitionOrder("weird" as "draft", "submit"), false);
  });
});

describe("actionPermission", () => {
  it("maps submit to :submit, others to :approve", () => {
    assert.equal(actionPermission("purchase", "submit"), "purchase:submit");
    assert.equal(actionPermission("purchase", "approve"), "purchase:approve");
    assert.equal(actionPermission("sales", "void"), "sales:approve");
  });
});
