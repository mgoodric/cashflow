import { analyzeCategoryMisclassifications, getCategories } from "@/actions/insights";
import { CategoryAudit } from "@/components/insights/category-audit";

export default async function CategoryAuditPage() {
  const [flags, categories] = await Promise.all([
    analyzeCategoryMisclassifications(),
    getCategories(),
  ]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Category Audit</h1>
        <p className="text-sm text-gray-500">
          Review and fix potential category misclassifications
        </p>
      </div>

      <CategoryAudit flags={flags} categories={categories} />
    </div>
  );
}
