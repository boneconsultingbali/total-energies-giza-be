export const Project = {
  Status: {
    Framing: "Framing",
    Qualification: "Qualification",
    ProblemSolving: "Problem Solving",
    Testing: "Testing",
    Scale: "Scale",
    DeploymentPlanning: "Deployment Planning",
    Deployment: "Deployment",
  },
  StatusColors: {
    Framing: "#FFB366",
    Qualification: "#6BB6FF",
    "Problem Solving": "#FFE066",
    Testing: "#FFCC80",
    Scale: "#B19CD9",
    "Deployment Planning": "#A8C8EC",
    Deployment: "#A8D8A8",
  },
  PerformanceValuePillar: {
    Operating: "Operating",
    Environmental: "Environmental",
    Safety: "Safety",
  },
  Domain: {
    DW: "D&W",
    Emission: "Emission",
    Exploration: "Exploration",
    GR: "G&R",
    Operations: "Operations",
    Production: "Production",
    Safety: "Safety",
    SupplyChain: "Supply chain / Logistics",
  },
};

export const ProjectStatuses = Object.values(Project.Status);
export const ProjectStatusColors = Project.StatusColors;
export const ProjectPerformanceValuePillars = Object.values(
  Project.PerformanceValuePillar
);
export const ProjectDomains = Object.values(Project.Domain);
