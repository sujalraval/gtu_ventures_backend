import "dotenv/config";
import prisma from "../src/lib/prisma";

const CATEGORIES = [
  {
    name: "Financial Progress",
    color: "bg-green-500",
    subcategories: [
      "Fund Utilization",
      "Revenue Growth",
      "Investment Raised",
      "Financial Compliance",
      "Budget Planning",
    ],
  },
  {
    name: "Market Validation",
    color: "bg-cyan-500",
    subcategories: [
      "Idea Validation",
      "Market Research",
      "Pilot Testing",
      "User Feedback",
      "Product-Market Fit",
    ],
  },
  {
    name: "Compliance",
    color: "bg-red-500",
    subcategories: [
      "Registration",
      "DPIIT Recognition",
      "Legal Filings",
      "Regulatory Approvals",
      "Audit Clearance",
    ],
  },
  {
    name: "Team & HR",
    color: "bg-blue-500",
    subcategories: [
      "Team Expansion",
      "Key Hires",
      "Advisory Board",
      "Training & Development",
    ],
  },
];

async function main() {
  for (const cat of CATEGORIES) {
    const existing = await (prisma as any).milestoneCategory.findUnique({
      where: { name: cat.name },
    });

    if (existing) {
      const merged = Array.from(new Set([...existing.subcategories, ...cat.subcategories]));
      await (prisma as any).milestoneCategory.update({
        where: { name: cat.name },
        data: { subcategories: merged, color: cat.color },
      });
      console.log(`✓ Updated : ${cat.name} (${merged.length} subcategories)`);
    } else {
      await (prisma as any).milestoneCategory.create({
        data: {
          name: cat.name,
          color: cat.color,
          subcategories: cat.subcategories,
        },
      });
      console.log(`✓ Created : ${cat.name} (${cat.subcategories.length} subcategories)`);
    }
  }

  console.log("\n✅ All categories seeded successfully.");
}

main()
  .catch(e => { console.error("❌ Seed failed:", e); process.exit(1); })
  .finally(() => (prisma as any).$disconnect());
