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
  PerformanceValuePillar: {
    Operating: "Operating",
    Environmental: "Environmental",
    Safety: "Safety",
  },
};

export const ProjectStatuses = Object.values(Project.Status);
export const ProjectPerformanceValuePillars = Object.values(
  Project.PerformanceValuePillar
);
