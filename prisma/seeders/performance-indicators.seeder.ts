import { PrismaClient } from "@prisma/client";

interface IndicatorData {
  name: string;
  description?: string;
  value?: string;
  children?: IndicatorData[];
}

export async function seedPerformanceIndicators(prisma: PrismaClient) {
  console.log("📊 Seeding performance indicators...");

  const indicatorData: IndicatorData[] = [
    {
      name: "Production optimization",
      description: "Optimize production processes and efficiency",
      children: [
        {
          name: "Deliver Profitable Project",
          description: "Ensure projects deliver expected profitability (5-10%)",
          value: "5-10%",
        },
      ],
    },
    {
      name: "Cost vigilance",
      description: "Monitor and control operational costs",
      children: [
        {
          name: "Monitor Daily Expenses",
          description:
            "Track daily operational expenses and identify cost-saving opportunities",
        },
        {
          name: "Review Supplier Contracts",
          description: "Regular review and optimization of supplier contracts",
        },
      ],
    },
    {
      name: "DE",
      description: "Digital Excellence and operational efficiency initiatives",
      children: [
        {
          name: "Operational Efficiency",
          description: "Improve operational processes and efficiency",
          children: [
            {
              name: "Improve Process",
              description: "Streamline and optimize business processes",
            },
            {
              name: "Train Staff",
              description:
                "Provide training to improve staff efficiency and skills",
            },
          ],
        },
        {
          name: "Deliver Profitable Project",
          description: "Project delivery with focus on profitability",
          children: [
            {
              name: "Deliver Profitable Project Management",
              description:
                "Implement effective project management practices for profitability",
            },
            {
              name: "Project Review",
              description:
                "Regular project reviews to ensure profitability targets",
            },
          ],
        },
      ],
    },
    {
      name: "Operational Cost",
      description: "Management and optimization of operational costs",
      children: [
        {
          name: "Operational Cost Management",
          description: "Strategic management of operational costs",
        },
        {
          name: "Expense Review",
          description: "Regular review and analysis of expenses",
        },
      ],
    },
    {
      name: "Decreasing Methane Intensity",
      description: "Environmental initiative to reduce methane emissions",
      children: [
        {
          name: "Upgrade Equipment",
          description: "Upgrade equipment to reduce methane emissions",
        },
        {
          name: "Monitor Emissions",
          description: "Continuous monitoring of methane emissions",
        },
        {
          name: "Implement Best Practices",
          description:
            "Implement industry best practices for methane reduction",
        },
      ],
    },
    {
      name: "Operating Performance",
      description: "Optimize overall operating performance",
      children: [
        {
          name: "System Tuning",
          description: "Optimize system performance through tuning",
        },
        {
          name: "Asset Utilization",
          description: "Maximize utilization of assets and resources",
        },
      ],
    },
    {
      name: "More Energy",
      description: "Increase energy production and efficiency",
      children: [
        {
          name: "Increase Output",
          description: "Increase energy output and production capacity",
        },
      ],
    },
    {
      name: "Growing Cash Flow",
      description: "Improve and grow cash flow generation",
      children: [
        {
          name: "Optimize Sales",
          description: "Optimize sales processes and revenue generation",
        },
        {
          name: "Reduce Overheads",
          description: "Reduce overhead costs to improve cash flow",
        },
      ],
    },
  ];

  // Helper function to create indicators recursively
  async function createIndicator(
    data: IndicatorData,
    parentId?: string
  ): Promise<any> {
    const indicator = await prisma.tbm_performance_indicator.upsert({
      where: { name: data.name },
      update: {},
      create: {
        name: data.name,
        description:
          data.description || `Performance indicator for ${data.name}`,
        parent_id: parentId,
      },
    });

    console.log(
      `✅ Created indicator: ${data.name}${parentId ? ` (child of parent)` : " (root)"}`
    );

    // Create children if they exist
    if (data.children && data.children.length > 0) {
      for (const child of data.children) {
        await createIndicator(child, indicator.id);
      }
    }

    return indicator;
  }

  // Create all indicators
  for (const rootIndicator of indicatorData) {
    await createIndicator(rootIndicator);
  }

  // Get statistics
  const stats = await prisma.tbm_performance_indicator.aggregate({
    _count: true,
  });

  const rootCount = await prisma.tbm_performance_indicator.count({
    where: { parent_id: null },
  });

  console.log(
    `✅ Created ${stats._count} performance indicators (${rootCount} root indicators)`
  );

  return stats;
}
