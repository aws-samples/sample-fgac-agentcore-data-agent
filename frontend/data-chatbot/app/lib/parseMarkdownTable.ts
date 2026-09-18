import { StructuredData } from "@/app/types";

/**
 * Parses a markdown table from text into StructuredData.
 * Detects pipe-delimited rows with a header separator line (e.g. |---|---|).
 * Returns null if no valid table is found.
 */
export function parseMarkdownTable(text: string): StructuredData | null {
  const lines = text.split("\n");

  // Find the separator line: matches lines like |---|---| or | :---: | ---: |
  const separatorRegex = /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/;
  let separatorIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    if (separatorRegex.test(lines[i].trim())) {
      separatorIndex = i;
      break;
    }
  }

  if (separatorIndex < 1) {
    // No separator found, or separator is the first line (no header above it)
    return null;
  }

  const headerLine = lines[separatorIndex - 1];
  const columns = parsePipeRow(headerLine);

  if (columns.length === 0) {
    return null;
  }

  const rows: Record<string, string | number>[] = [];

  for (let i = separatorIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || !line.includes("|")) {
      break; // End of table
    }

    const cells = parsePipeRow(line);
    const row: Record<string, string | number> = {};

    for (let j = 0; j < columns.length; j++) {
      const raw = j < cells.length ? cells[j] : "";
      row[columns[j]] = tryParseNumber(raw);
    }

    rows.push(row);
  }

  return { columns, rows };
}

/** Splits a pipe-delimited row into trimmed cell values. */
function parsePipeRow(line: string): string[] {
  let trimmed = line.trim();

  // Strip leading and trailing pipes
  if (trimmed.startsWith("|")) {
    trimmed = trimmed.slice(1);
  }
  if (trimmed.endsWith("|")) {
    trimmed = trimmed.slice(0, -1);
  }

  return trimmed.split("|").map((cell) => cell.trim());
}

/** Attempts to parse a string as a number. Returns the number if valid, otherwise the original string. */
function tryParseNumber(value: string): string | number {
  if (value === "") return value;
  const num = Number(value);
  return !isNaN(num) && value.trim() !== "" ? num : value;
}
