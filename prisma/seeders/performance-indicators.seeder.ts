import { Project } from "../../src/constants/project";
import { PrismaClient } from "@prisma/client";

interface IndicatorData {
  pillar?: string;
  name: string;
  description?: string;

  min_score?: number;
  max_score?: number;

  value?: string;
  is_grey?: boolean;

  children?: IndicatorData[];
}

export async function seedPerformanceIndicators(prisma: PrismaClient) {
  console.log("📊 Seeding performance indicators...");

  const indicatorData: IndicatorData[] = [
    {
      pillar: Project.PerformanceValuePillar.Operating,
      name: "Production optimization (More Energy)",
      description: "Optimize production processes and efficiency",
      children: [
        {
          pillar: Project.PerformanceValuePillar.Operating,
          name: "Early Anomaly Detection Rate",
          description:
            "Implement early detection of anomalies to prevent issues",
          min_score: -80,
          max_score: -100,
        },
        {
          pillar: Project.PerformanceValuePillar.Operating,
          name: "Critical equipment failure Rate",
          description: "Monitor and reduce critical equipment failure rates",
          min_score: -5,
          max_score: -10,
        },
        {
          pillar: Project.PerformanceValuePillar.Operating,
          name: "Deliver Profitable Project",
          description: "Ensure projects deliver expected profitability (5-10%)",
          is_grey: true,
        },
      ],
    },
    {
      pillar: Project.PerformanceValuePillar.Operating,
      name: "Cost vigilance (Growing Cash Flow)",
      description: "Monitor and control operational costs",
      children: [
        {
          pillar: Project.PerformanceValuePillar.Operating,
          name: "Inspection Cost",
          description: "Optimize inspection costs for efficiency",
          min_score: -30,
          max_score: -40,
        },
        {
          pillar: Project.PerformanceValuePillar.Operating,
          name: "Maintenance Cost",
          description: "Track and manage maintenance costs effectively",
          min_score: -20,
          max_score: -30,
        },
      ],
    },
    {
      pillar: Project.PerformanceValuePillar.Environmental,
      name: "Reduce emissions (More Sustainable)",
      description:
        "Implement strategies to reduce emissions and enhance sustainability",
      children: [
        {
          pillar: Project.PerformanceValuePillar.Environmental,
          name: "Care for the Environment",
          description: "Decreasing methane intensity and emissions",
          is_grey: true,
        },
      ],
    },
    {
      pillar: Project.PerformanceValuePillar.Environmental,
      name: "Reduce emissions (Less Emissions)",
      description:
        "Implement strategies to reduce emissions and enhance sustainability",
      children: [
        {
          pillar: Project.PerformanceValuePillar.Environmental,
          name: "Decreasing scope 1 and 2 emissions",
          description: "Focus on reducing scope 1 and 2 emissions",
          is_grey: true,
        },
        {
          pillar: Project.PerformanceValuePillar.Environmental,
          name: "Fugitive methane emissions",
          description: "Monitor and reduce fugitive methane emissions",
        },
        {
          pillar: Project.PerformanceValuePillar.Environmental,
          name: "Methane emissions per production unit",
          description: "Track methane emissions relative to production output",
          min_score: 15,
          max_score: 20,
        },
        {
          pillar: Project.PerformanceValuePillar.Environmental,
          name: "Methane leak detection rate",
          description: "Improve detection rate of methane leaks",
          min_score: 30,
          max_score: 50,
        },
        {
          pillar: Project.PerformanceValuePillar.Environmental,
          name: "Methane leak capture rate",
          description: "Increase capture rate of detected methane leaks",
          min_score: 20,
          max_score: 30,
        },
        {
          pillar: Project.PerformanceValuePillar.Environmental,
          name: "Quantity of methane emitted",
          description: "Measure the total quantity of methane emitted",
          min_score: 10,
          max_score: 20,
        },
        {
          pillar: Project.PerformanceValuePillar.Environmental,
          name: "Eliminate (routine RT) Flaring",
          description: "Reduce routine flaring of methane",
          is_grey: true,
        },
      ],
    },
    {
      pillar: Project.PerformanceValuePillar.Safety,
      name: "Productivity & Quantity (Safety Performance)",
      description: "Enhance safety performance and productivity",
      children: [
        {
          pillar: Project.PerformanceValuePillar.Safety,
          name: "Reliability of safety barrier",
          description: "Ensure reliability of safety barriers",
        },
        {
          pillar: Project.PerformanceValuePillar.Safety,
          name: "Efficiency of integrity processes",
          description: "Enhance the efficiency of integrity processes",
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
        pillar: data.pillar,
        name: data.name,
        description:
          data.description || `Performance indicator for ${data.name}`,

        min_score: data.min_score,
        max_score: data.max_score,

        is_grey: data.is_grey || false,

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
