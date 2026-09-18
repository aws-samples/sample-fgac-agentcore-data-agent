// Feature: chatbot-frontend, Property 19: Markdown table parsing round-trip
// **Validates: Requirements 8.1**

import fc from "fast-check";
import { parseMarkdownTable } from "@/app/lib/parseMarkdownTable";
import { StructuredData } from "@/app/types";

/**
 * Formats a StructuredData object as a markdown table string.
 * Produces:
 *   | col1 | col2 | ... |
 *   |------|------|-----|
 *   | val1 | val2 | ... |
 */
function formatMarkdownTable(data: StructuredData): string {
  const { columns, rows } = data;
  const header = "| " + columns.join(" | ") + " |";
  const separator = "| " + columns.map(() => "---").join(" | ") + " |";
  const dataRows = rows.map(
    (row) => "| " + columns.map((col) => String(row[col] ?? "")).join(" | ") + " |"
  );
  return [header, separator, ...dataRows].join("\n");
}

// Arbitrary for safe column names: start with a letter, then alphanumeric/underscore
const safeColumnName = fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_]{0,9}$/);

// Arbitrary for safe string values: alphanumeric, won't be parsed as a number
// Prefix with a letter to ensure tryParseNumber returns the string as-is
const safeStringValue = fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_]{0,9}$/);

// Arbitrary for integer values (safe for number round-trip)
const safeIntValue = fc.integer({ min: -99999, max: 99999 });

// Arbitrary for a cell value: either a safe string or an integer
const cellValue = fc.oneof(safeStringValue, safeIntValue);

// Arbitrary for StructuredData with 2-5 unique columns and 0-5 rows
// Note: parser separator regex requires 2+ columns to match (|---|---|)
const structuredDataArb = fc
  .uniqueArray(safeColumnName, { minLength: 2, maxLength: 5 })
  .chain((columns) => {
    const rowArb = fc.record(
      Object.fromEntries(columns.map((col) => [col, cellValue]))
    ) as fc.Arbitrary<Record<string, string | number>>;

    return fc.array(rowArb, { minLength: 0, maxLength: 5 }).map((rows) => ({
      columns,
      rows,
    }));
  });

describe("Property 19: Markdown table parsing round-trip", () => {
  it("formatting StructuredData as markdown and parsing back should produce equivalent data", () => {
    fc.assert(
      fc.property(structuredDataArb, (original: StructuredData) => {
        const markdown = formatMarkdownTable(original);
        const parsed = parseMarkdownTable(markdown);

        // Must parse successfully
        expect(parsed).not.toBeNull();

        // Same columns
        expect(parsed!.columns).toEqual(original.columns);

        // Same number of rows
        expect(parsed!.rows.length).toBe(original.rows.length);

        // Each row matches: values should be equivalent
        for (let i = 0; i < original.rows.length; i++) {
          for (const col of original.columns) {
            const originalVal = original.rows[i][col];
            const parsedVal = parsed!.rows[i][col];

            if (typeof originalVal === "number") {
              // Numbers should round-trip exactly
              expect(parsedVal).toBe(originalVal);
            } else {
              // Strings should match (tryParseNumber won't convert alpha-prefixed strings)
              expect(parsedVal).toBe(originalVal);
            }
          }
        }
      }),
      { numRuns: 100 }
    );
  });
});
