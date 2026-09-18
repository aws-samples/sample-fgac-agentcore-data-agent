import fc from "fast-check";

describe("Test framework setup", () => {
  it("jest runs", () => {
    expect(1 + 1).toBe(2);
  });

  it("fast-check runs", () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), (a, b) => {
        expect(a + b).toBe(b + a);
      }),
      { numRuns: 10 }
    );
  });
});
