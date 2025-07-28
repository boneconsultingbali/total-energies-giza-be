export class TimelineActivity {
  event: string;
  description: string;
  date: string;
  creator: {
    name: string;
  };
}

export class ProjectTimelinePhase {
  name: string;
  startDate: string;
  endDate: string;
  color: string;
  activities: TimelineActivity[];
}

export class ProjectTimelineResponse extends Array<ProjectTimelinePhase> {}
