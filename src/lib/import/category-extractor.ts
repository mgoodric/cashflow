import type { ParsedQifCategory, ParsedQifTransaction } from "./qif-parser";

/**
 * Build the category tree from transaction categories, extracting parent paths.
 * Excludes transfer categories. Shared by both QIF and CSV parsers.
 */
export function extractCategoriesFromTransactions(
  transactions: ParsedQifTransaction[]
): ParsedQifCategory[] {
  const categoryPaths = new Set<string>();

  for (const t of transactions) {
    if (t.category && !t.isTransfer) {
      categoryPaths.add(t.category);
      const parts = t.category.split(":");
      for (let i = 1; i < parts.length; i++) {
        categoryPaths.add(parts.slice(0, i).join(":"));
      }
    }
  }

  return Array.from(categoryPaths)
    .sort()
    .map((path) => {
      const parts = path.split(":");
      return {
        path,
        name: parts[parts.length - 1],
        parentPath: parts.length > 1 ? parts.slice(0, -1).join(":") : null,
      };
    });
}
