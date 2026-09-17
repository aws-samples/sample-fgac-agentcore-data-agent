import { parseMarkdownTable } from "./parseMarkdownTable";

describe("parseMarkdownTable", () => {
  it("parses a standard markdown table", () => {
    const md = [
      "| name  | age | city     |",
      "|-------|-----|----------|",
      "| Alice | 30  | New York |",
      "| Bob   | 25  | London   |",
    ].join("\n");

    const result = parseMarkdownTable(md);
    expect(result).toEqual({
      columns: ["name", "age", "city"],
      rows: [
        { name: "Alice", age: 30, city: "New York" },
        { name: "Bob", age: 25, city: "London" },
      ],
    });
  });

  it("returns null when no table is present", () => {
    expect(parseMarkdownTable("just some text")).toBeNull();
    expect(parseMarkdownTable("")).toBeNull();
  });

  it("returns null when separator is the first line (no header)", () => {
    const md = "|---|---|\n| a | b |";
    expect(parseMarkdownTable(md)).toBeNull();
  });

  it("handles a table with header and separator but no data rows", () => {
    const md = "| col1 | col2 |\n|------|------|";
    const result = parseMarkdownTable(md);
    expect(result).toEqual({ columns: ["col1", "col2"], rows: [] });
  });

  it("parses numeric values as numbers", () => {
    const md = [
      "| item  | price | qty |",
      "|-------|-------|-----|",
      "| apple | 1.5   | 10  |",
    ].join("\n");

    const result = parseMarkdownTable(md);
    expect(result).not.toBeNull();
    expect(result!.rows[0]).toEqual({ item: "apple", price: 1.5, qty: 10 });
  });

  it("keeps non-numeric values as strings", () => {
    const md = [
      "| id | label   |",
      "|----|---------|",
      "| 1  | hello   |",
      "| 2  | world   |",
    ].join("\n");

    const result = parseMarkdownTable(md);
    expect(result!.rows[0]).toEqual({ id: 1, label: "hello" });
    expect(result!.rows[1]).toEqual({ id: 2, label: "world" });
  });

  it("handles extra whitespace in cells", () => {
    const md = [
      "|  name   |   value   |",
      "|---------|-----------|",
      "|  foo    |   42      |",
    ].join("\n");

    const result = parseMarkdownTable(md);
    expect(result).toEqual({
      columns: ["name", "value"],
      rows: [{ name: "foo", value: 42 }],
    });
  });

  it("handles alignment colons in separator", () => {
    const md = [
      "| left | center | right |",
      "|:-----|:------:|------:|",
      "| a    | b      | c     |",
    ].join("\n");

    const result = parseMarkdownTable(md);
    expect(result).toEqual({
      columns: ["left", "center", "right"],
      rows: [{ left: "a", center: "b", right: "c" }],
    });
  });

  it("stops parsing rows when a non-table line is encountered", () => {
    const md = [
      "| a | b |",
      "|---|---|",
      "| 1 | 2 |",
      "",
      "Some other text",
      "| x | y |",
    ].join("\n");

    const result = parseMarkdownTable(md);
    expect(result).toEqual({
      columns: ["a", "b"],
      rows: [{ a: 1, b: 2 }],
    });
  });

  it("handles table embedded in surrounding text", () => {
    const md = [
      "Here are the results:",
      "",
      "| venue_id | name    |",
      "|----------|---------|",
      "| 101      | Stadium |",
      "| 102      | Arena   |",
      "",
      "That's all!",
    ].join("\n");

    const result = parseMarkdownTable(md);
    expect(result).toEqual({
      columns: ["venue_id", "name"],
      rows: [
        { venue_id: 101, name: "Stadium" },
        { venue_id: 102, name: "Arena" },
      ],
    });
  });

  it("fills missing cells with empty string", () => {
    const md = [
      "| a | b | c |",
      "|---|---|---|",
      "| 1 |",
    ].join("\n");

    const result = parseMarkdownTable(md);
    expect(result!.rows[0]).toEqual({ a: 1, b: "", c: "" });
  });
});
