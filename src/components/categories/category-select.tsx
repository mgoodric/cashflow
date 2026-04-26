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
  children: TreeNode[];
  depth: number;
  fullPath: string;
}

function buildTree(categories: Category[], filterType?: "income" | "expense" | null): TreeNode[] {
  const byParent = new Map<string | null, Category[]>();
  for (const cat of categories) {
    // Filter by type if specified — null category_type matches anything
    if (filterType && cat.category_type && cat.category_type !== filterType) continue;
    const key = cat.parent_id ?? "__root__";
    const list = byParent.get(key) ?? [];
    list.push(cat);
    byParent.set(key, list);
  }

  function expand(parentId: string | null, depth: number, pathPrefix: string): TreeNode[] {
    const key = parentId ?? "__root__";
    const children = byParent.get(key) ?? [];
    return children
      .sort((a, b) => a.name.localeCompare(b.name))
      .flatMap((cat) => {
        const fullPath = pathPrefix ? `${pathPrefix} > ${cat.name}` : cat.name;
        const node: TreeNode = { category: cat, children: [], depth, fullPath };
        const childNodes = expand(cat.id, depth + 1, fullPath);
        node.children = childNodes;
        return [node, ...childNodes];
      });
  }

  return expand(null, 0, "");
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
          {node.category.category_type ? ` (${node.category.category_type})` : ""}
        </option>
      ))}
    </select>
  );
}
