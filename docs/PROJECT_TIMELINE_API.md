# Project Timeline API

## Endpoint

```
GET /projects/timeline/:id
```

## Description

Fetches the project timeline organized by phases with activities for each phase.

## Parameters

- `id` (string): The project ID

## Response Format

Returns an array of timeline phases, each containing:

```typescript
interface TimelineActivity {
  event: string;
  description: string;
  date: string; // ISO string
  creator: {
    name: string;
  };
}

interface ProjectTimelinePhase {
  name: string;
  startDate: string; // YYYY-MM-DD format
  endDate: string; // YYYY-MM-DD format
  color: string; // Hex color code
  activities: TimelineActivity[];
}

type ProjectTimelineResponse = ProjectTimelinePhase[];
```

## Example Response

```json
[
  {
    "name": "Framing",
    "startDate": "2025-01-15",
    "endDate": "2025-02-28",
    "color": "#FFB366",
    "activities": [
      {
        "event": "Project Initiation",
        "description": "Started the farming phase of the project",
        "date": "2025-01-15T09:00:00.000Z",
        "creator": { "name": "John Smith" }
      }
    ]
  },
  {
    "name": "Qualification",
    "startDate": "2025-03-01",
    "endDate": "2025-03-31",
    "color": "#6BB6FF",
    "activities": [
      {
        "event": "Technical Review",
        "description": "Conducted technical feasibility assessment",
        "date": "2025-03-05T10:00:00.000Z",
        "creator": { "name": "Emily Chen" }
      }
    ]
  }
]
```

## Phase Colors

- **Framing**: #FFB366 (Orange)
- **Qualification**: #6BB6FF (Blue)
- **Problem Solving**: #FFE066 (Yellow)
- **Testing**: #FFCC80 (Light Orange)
- **Scale**: #B19CD9 (Purple)
- **Deployment Planning**: #A8C8EC (Light Blue)
- **Deployment**: #A8D8A8 (Green)

## Authentication

Requires valid JWT token and `project:read` permission.

## Error Responses

- `404 Not Found`: Project not found
- `403 Forbidden`: Access denied to this project
- `401 Unauthorized`: Invalid or missing authentication
