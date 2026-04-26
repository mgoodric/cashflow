"use client";

import { useMemo } from "react";
import { SELECT_CLASS } from "@/lib/constants";
import type { Category } from "@/lib/types/database";

interface CategorySelectProps {
  categories: Category[];
  value: string;
  onChange: (value: string) => void;
  filterType?: "income" | "expense" | null;
  id?: string;
  name?: string;
  className?: string;
}

interface TreeNode {
  category: Category;
  effectiveType: "income" | "expense" | null;
  depth: number;
}

/**
 * Resolve effective category type by walking up the parent chain.
 * A category's own type takes precedence; if null, inherits from parent.
 */
function resolveEffectiveTypes(categories: Category[]): Map<string, "income" | "expense" | null> {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const cache = new Map<string, "income" | "expense" | null>();

  function resolve(id: string): "income" | "expense" | null {
    if (cache.has(id)) return cache.get(id)!;
    const cat = byId.get(id);
    if (!cat) { cache.set(id, null); return null; }

    if (cat.category_type) {
      cache.set(id, cat.category_type);
      return cat.category_type;
    }

    const inherited = cat.parent_id ? resolve(cat.parent_id) : null;
    cache.set(id, inherited);
    return inherited;
  }

  for (const cat of categories) resolve(cat.id);
  return cache;
}

function buildTree(categories: Category[], filterType?: "income" | "expense" | null): TreeNode[] {
  const effectiveTypes = resolveEffectiveTypes(categories);

  // Filter categories based on effective type
  const included = new Set<string>();
  for (const cat of categories) {
    const effective = effectiveTypes.get(cat.id) ?? null;
    if (!filterType || !effective || effective === filterType) {
      included.add(cat.id);
    }
  }

  // Also include parents of included categories so the tree isn't broken
  const byId = new Map(categories.map((c) => [c.id, c]));
  for (const cat of categories) {
    if (included.has(cat.id) && cat.parent_id && !included.has(cat.parent_id)) {
      let parentId: string | null = cat.parent_id;
      while (parentId) {
        included.add(parentId);
        parentId = byId.get(parentId)?.parent_id ?? null;
      }
    }
  }

  const byParent = new Map<string, Category[]>();
  for (const cat of categories) {
    if (!included.has(cat.id)) continue;
    const key = cat.parent_id ?? "__root__";
    const list = byParent.get(key) ?? [];
    list.push(cat);
    byParent.set(key, list);
  }

  function expand(parentId: string | null, depth: number): TreeNode[] {
    const key = parentId ?? "__root__";
    const children = byParent.get(key) ?? [];
    return children
      .sort((a, b) => a.name.localeCompare(b.name))
      .flatMap((cat) => {
        const node: TreeNode = {
          category: cat,
          effectiveType: effectiveTypes.get(cat.id) ?? null,
          depth,
        };
        return [node, ...expand(cat.id, depth + 1)];
      });
  }

  return expand(null, 0);
}

export function CategorySelect({
  categories,
  value,
  onChange,
  filterType,
  id,
  name,
  className,
}: CategorySelectProps) {
  const treeNodes = useMemo(() => buildTree(categories, filterType), [categories, filterType]);

  return (
    <select
      id={id}
      name={name}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={className ?? SELECT_CLASS}
    >
      <option value="">No category</option>
      {treeNodes.map((node) => (
        <option key={node.category.id} value={node.category.id}>
          {"  ".repeat(node.depth)}{node.depth > 0 ? "└ " : ""}{node.category.name}
        </option>
      ))}
    </select>
  );
}

/**
 * Utility to get effective type for a category, considering inheritance.
 * Exported for use in other components (e.g., category tree display).
 */
export { resolveEffectiveTypes };
