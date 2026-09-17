// Feature: chatbot-frontend, Property 20: Data click opens drawer
// Feature: chatbot-frontend, Property 21: Drawer content retention round-trip

import React from "react";
import { render, screen } from "@testing-library/react";
import fc from "fast-check";
import VisualizationDrawer from "@/app/components/VisualizationDrawer";
import type { StructuredData } from "@/app/types";

/**
 * Arbitrary: generates an alphanumeric column name (1-10 chars, starts with letter).
 */
const arbColumnName = (): fc.Arbitrary<string> =>
  fc.stringMatching(/^[a-z][a-z0-9]{0,9}$/);

/**
 * Arbitrary: generates a cell value — either a string or an integer.
 */
const arbCellValue = (): fc.Arbitrary<string | number> =>
  fc.oneof(
    fc.stringMatching(/^[a-zA-Z0-9]{1,10}$/),
    fc.integer({ min: 0, max: 9999 })
  );

/**
 * Arbitrary: generates a StructuredData object with 1-5 unique columns and 1-5 rows.
 */
const arbStructuredData = (): fc.Arbitrary<StructuredData> =>
  fc
    .uniqueArray(arbColumnName(), { minLength: 1, maxLength: 5 })
    .chain((columns) => {
      const arbRow = fc.record(
        Object.fromEntries(columns.map((col) => [col, arbCellValue()]))
      ) as fc.Arbitrary<Record<string, string | number>>;

      return fc.array(arbRow, { minLength: 1, maxLength: 5 }).map((rows) => ({
        columns,
        rows,
      }));
    });

// Feature: chatbot-frontend, Property 20: Data click opens drawer
// **Validates: Requirements 8.3**
describe("Property 20: Data click opens drawer", () => {
  it("when isOpen=true with generated StructuredData, drawer-table is present with correct headers and row values", () => {
    fc.assert(
      fc.property(arbStructuredData(), (data) => {
        const onClose = jest.fn();
        const { unmount } = render(
          <VisualizationDrawer
            isOpen={true}
            data={data}
            onClose={onClose}
            isMobile={false}
          />
        );

        // Verify drawer-table is present
        const table = screen.getByTestId("drawer-table");
        expect(table).toBeInTheDocument();

        // Verify table headers match the generated columns
        const headers = table.querySelectorAll("th");
        expect(headers).toHaveLength(data.columns.length);
        data.columns.forEach((col, i) => {
          expect(headers[i].textContent).toBe(col);
        });

        // Verify table rows contain the generated values
        const bodyRows = table.querySelectorAll("tbody tr");
        expect(bodyRows).toHaveLength(data.rows.length);
        data.rows.forEach((row, rowIdx) => {
          const cells = bodyRows[rowIdx].querySelectorAll("td");
          expect(cells).toHaveLength(data.columns.length);
          data.columns.forEach((col, colIdx) => {
            expect(cells[colIdx].textContent).toBe(String(row[col]));
          });
        });

        unmount();
      }),
      { numRuns: 30 }
    );
  });
});

// Feature: chatbot-frontend, Property 21: Drawer content retention round-trip
// **Validates: Requirements 8.5**
describe("Property 21: Drawer content retention round-trip", () => {
  it("open → close → re-open preserves the same data", () => {
    fc.assert(
      fc.property(arbStructuredData(), (data) => {
        const onClose = jest.fn();
        const baseProps = { data, onClose, isMobile: false };

        // Step 1: Render with isOpen=true — verify table is present with correct data
        const { rerender, unmount } = render(
          <VisualizationDrawer {...baseProps} isOpen={true} />
        );

        const table = screen.getByTestId("drawer-table");
        expect(table).toBeInTheDocument();

        // Capture initial header and cell values
        const initialHeaders = Array.from(table.querySelectorAll("th")).map(
          (th) => th.textContent
        );
        const initialCells = Array.from(
          table.querySelectorAll("tbody tr")
        ).map((tr) =>
          Array.from(tr.querySelectorAll("td")).map((td) => td.textContent)
        );

        // Step 2: Re-render with isOpen=false — drawer should not be in the document
        rerender(<VisualizationDrawer {...baseProps} isOpen={false} />);
        expect(
          screen.queryByTestId("visualization-drawer")
        ).not.toBeInTheDocument();

        // Step 3: Re-render with isOpen=true again — same data prop
        rerender(<VisualizationDrawer {...baseProps} isOpen={true} />);

        const reopenedTable = screen.getByTestId("drawer-table");
        expect(reopenedTable).toBeInTheDocument();

        // Verify headers match the original
        const reopenedHeaders = Array.from(
          reopenedTable.querySelectorAll("th")
        ).map((th) => th.textContent);
        expect(reopenedHeaders).toEqual(initialHeaders);

        // Verify cell values match the original
        const reopenedCells = Array.from(
          reopenedTable.querySelectorAll("tbody tr")
        ).map((tr) =>
          Array.from(tr.querySelectorAll("td")).map((td) => td.textContent)
        );
        expect(reopenedCells).toEqual(initialCells);

        unmount();
      }),
      { numRuns: 30 }
    );
  });
});
