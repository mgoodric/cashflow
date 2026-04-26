"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SELECT_CLASS } from "@/lib/constants";
import { createCategory, updateCategory, deleteCategory } from "@/actions/categories";
import type { Category } from "@/lib/types/database";
import type { CategoryBudgetStatus } from "@/lib/budget";

interface CategoryTreeProps {
  categories: Category[];
  budgetStatuses: CategoryBudgetStatus[];
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function BudgetIndicator({ status }: { status: CategoryBudgetStatus }) {
  const pct = Math.round(status.percentage);
  const colorClass =
    status.status === "over"
      ? "bg-red-500"
      : status.status === "warning"
        ? "bg-yellow-500"
        : "bg-green-500";

  const barWidth = Math.min(pct, 100);

  return (
    <div className="mt-1 space-y-1">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>
          {formatCurrency(status.spending)} / {formatCurrency(status.category.budget_limit!)}
        </span>
        {status.status === "over" && (
          <Badge variant="destructive">Over budget</Badge>
        )}
        {status.status === "warning" && (
          <Badge variant="secondary">Nearing limit</Badge>
        )}
      </div>
      <div className="h-1.5 w-full max-w-48 rounded-full bg-muted">
        <div
          className={`h-1.5 rounded-full ${colorClass}`}
          style={{ width: `${barWidth}%` }}
        />
      </div>
    </div>
  );
}

function CategoryItem({
  category,
  allCategories,
  budgetMap,
  onEdit,
}: {
  category: Category;
  allCategories: Category[];
  budgetMap: Map<string, CategoryBudgetStatus>;
  onEdit: (cat: Category) => void;
}) {
  const childCategories = allCategories.filter((c) => c.parent_id === category.id);
  const budgetStatus = budgetMap.get(category.id);

  return (
    <div className="border-b last:border-b-0">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">{category.name}</span>
            {category.category_type && (
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${category.category_type === "income" ? "text-green-600 border-green-400/50" : "text-red-600 border-red-400/50"}`}>
                {category.category_type}
              </Badge>
            )}
            {category.budget_limit !== null && (
              <span className="text-xs text-muted-foreground">
                (Limit: {formatCurrency(category.budget_limit)})
              </span>
            )}
          </div>
          {budgetStatus && <BudgetIndicator status={budgetStatus} />}
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => onEdit(category)}>
            Edit
          </Button>
          <form action={deleteCategory.bind(null, category.id)}>
            <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700">
              Delete
            </Button>
          </form>
        </div>
      </div>
      {childCategories.length > 0 && (
        <div className="ml-6 border-l">
          {childCategories.map((child) => (
            <CategoryItem
              key={child.id}
              category={child}
              allCategories={allCategories}
              budgetMap={budgetMap}
              onEdit={onEdit}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function CategoryTree({ categories, budgetStatuses }: CategoryTreeProps) {
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [showForm, setShowForm] = useState(false);

  const rootCategories = categories.filter((c) => c.parent_id === null);
  const budgetMap = new Map(budgetStatuses.map((s) => [s.category.id, s]));

  function handleEdit(cat: Category) {
    setEditingCategory(cat);
    setShowForm(true);
  }

  function handleCancel() {
    setEditingCategory(null);
    setShowForm(false);
  }

  const formAction = editingCategory
    ? updateCategory.bind(null, editingCategory.id)
    : createCategory;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Categories</h1>
          <p className="text-sm text-muted-foreground">Manage spending categories and budget limits</p>
        </div>
        {!showForm && (
          <Button onClick={() => setShowForm(true)}>Add Category</Button>
        )}
      </div>

      {showForm && (
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle>
              {editingCategory ? "Edit Category" : "New Category"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form action={formAction} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Category Name</Label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={editingCategory?.name}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="parent_id">Parent Category</Label>
                <select
                  id="parent_id"
                  name="parent_id"
                  defaultValue={editingCategory?.parent_id ?? ""}
                  className={SELECT_CLASS}
                >
                  <option value="">None (top-level)</option>
                  {categories
                    .filter((c) => c.id !== editingCategory?.id)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="category_type">Type</Label>
                <select
                  id="category_type"
                  name="category_type"
                  defaultValue={editingCategory?.category_type ?? ""}
                  className={SELECT_CLASS}
                >
                  <option value="">Any (income or expense)</option>
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="budget_limit">Monthly Budget Limit</Label>
                <Input
                  id="budget_limit"
                  name="budget_limit"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="No limit"
                  defaultValue={editingCategory?.budget_limit ?? ""}
                />
                <p className="text-xs text-muted-foreground">
                  Leave blank for no budget limit. Only expense events count against the budget.
                </p>
              </div>

              <div className="flex gap-2">
                <Button type="submit">
                  {editingCategory ? "Update" : "Create"}
                </Button>
                <Button type="button" variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {rootCategories.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No categories yet. Create one to get started.
            </div>
          ) : (
            rootCategories.map((cat) => (
              <CategoryItem
                key={cat.id}
                category={cat}
                allCategories={categories}
                budgetMap={budgetMap}
                onEdit={handleEdit}
              />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
