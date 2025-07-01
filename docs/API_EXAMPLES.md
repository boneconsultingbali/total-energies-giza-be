# API Usage Examples

This document provides practical examples of how to use the NestJS User Management API.

## Table of Contents
1. [Authentication Flow](#authentication-flow)
2. [User Management](#user-management)
3. [Project Management](#project-management)
4. [Performance Indicators](#performance-indicators)
5. [Document Management](#document-management)
6. [Advanced Scenarios](#advanced-scenarios)

## Authentication Flow

### 1. Login and Get Token
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "admin123"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "clr1234567890",
      "email": "admin@example.com",
      "role": {
        "name": "admin"
      },
      "permissions": ["user:create", "user:read", "user:update", "project:create"],
      "profile": {
        "first_name": "Admin",
        "last_name": "User"
      }
    }
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### 2. Use Token for Subsequent Requests
```bash
# Set token as environment variable
export JWT_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Use in requests
curl -X GET http://localhost:3000/api/v1/auth/me \
  -H "Authorization: Bearer $JWT_TOKEN"
```

## User Management

### 1. Create a New User
```bash
curl -X POST http://localhost:3000/api/v1/users \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john.doe@example.com",
    "password": "securepassword123",
    "role_name": "user",
    "is_active": true,
    "profile": {
      "first_name": "John",
      "last_name": "Doe",
      "phone": "+1-555-0123",
      "country": "United States",
      "city": "New York",
      "address": "123 Main St",
      "postal_code": "10001"
    }
  }'
```

### 2. Search Users with Filters
```bash
# Search by name and filter by role
curl -X GET "http://localhost:3000/api/v1/users?q=john&role=user&active=true&page=1&limit=10" \
  -H "Authorization: Bearer $JWT_TOKEN"

# Search by email
curl -X GET "http://localhost:3000/api/v1/users?search=admin@example.com" \
  -H "Authorization: Bearer $JWT_TOKEN"
```

### 3. Update User Profile
```bash
curl -X PATCH http://localhost:3000/api/v1/users/clr1234567890 \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "profile": {
      "first_name": "John Updated",
      "phone": "+1-555-9999",
      "city": "Los Angeles"
    }
  }'
```

### 4. Manage User Status
```bash
# Deactivate user
curl -X POST http://localhost:3000/api/v1/users/clr1234567890/deactivate \
  -H "Authorization: Bearer $JWT_TOKEN"

# Activate user
curl -X POST http://localhost:3000/api/v1/users/clr1234567890/activate \
  -H "Authorization: Bearer $JWT_TOKEN"

# Unlock user account
curl -X POST http://localhost:3000/api/v1/users/clr1234567890/unlock \
  -H "Authorization: Bearer $JWT_TOKEN"
```

## Project Management

### 1. Create Project with KPIs
```bash
curl -X POST http://localhost:3000/api/v1/projects \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "PROJ001",
    "name": "Digital Transformation Initiative",
    "description": "Company-wide digital transformation to improve efficiency and reduce costs",
    "start_date": "2024-01-01",
    "end_date": "2024-12-31",
    "status": "Planning",
    "indicators": [
      {
        "indicator_id": "clr_production_opt_123",
        "score": 75
      },
      {
        "indicator_id": "clr_cost_vigilance_456",
        "score": 80
      }
    ]
  }'
```

### 2. Get Projects with Filtering
```bash
# Get all projects
curl -X GET "http://localhost:3000/api/v1/projects?page=1&limit=10" \
  -H "Authorization: Bearer $JWT_TOKEN"

# Filter by status
curl -X GET "http://localhost:3000/api/v1/projects?status=Planning&page=1&limit=5" \
  -H "Authorization: Bearer $JWT_TOKEN"

# Search projects
curl -X GET "http://localhost:3000/api/v1/projects?q=digital&sortBy=created_at&sortOrder=desc" \
  -H "Authorization: Bearer $JWT_TOKEN"
```

### 3. Update Project Status
```bash
# Add status update
curl -X POST http://localhost:3000/api/v1/projects/clr_project_123/statuses \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "In Progress",
    "description": "Development phase has started. Team assigned and requirements finalized."
  }'

# Get status history
curl -X GET http://localhost:3000/api/v1/projects/clr_project_123/statuses \
  -H "Authorization: Bearer $JWT_TOKEN"
```

### 4. Update KPI Scores
```bash
# Update individual KPI score
curl -X PUT http://localhost:3000/api/v1/projects/clr_project_123/indicators/clr_production_opt_123/score \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"score": 85}'

# Update another KPI
curl -X PUT http://localhost:3000/api/v1/projects/clr_project_123/indicators/clr_cost_vigilance_456/score \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"score": 90}'
```

### 5. Get Project Statistics
```bash
curl -X GET http://localhost:3000/api/v1/projects/statistics \
  -H "Authorization: Bearer $JWT_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "total": 25,
    "by_status": [
      { "status": "Planning", "_count": 5 },
      { "status": "In Progress", "_count": 15 },
      { "status": "Completed", "_count": 5 }
    ],
    "by_owner": [
      { "owner_id": "clr_user_123", "_count": 10 },
      { "owner_id": "clr_user_456", "_count": 15 }
    ],
    "recent_projects": [
      {
        "id": "clr_project_123",
        "code": "PROJ001",
        "name": "Digital Transformation",
        "status": "In Progress",
        "score": 87.5,
        "created_at": "2024-01-15T10:30:00.000Z"
      }
    ]
  }
}
```

## Performance Indicators

### 1. Get Indicator Hierarchy
```bash
curl -X GET http://localhost:3000/api/v1/performance-indicators/hierarchy \
  -H "Authorization: Bearer $JWT_TOKEN"
```

### 2. Create New Indicator
```bash
curl -X POST http://localhost:3000/api/v1/performance-indicators \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Customer Satisfaction",
    "description": "Measure customer satisfaction through surveys and feedback",
    "parent_id": "clr_operational_performance_123"
  }'
```

### 3. Search Indicators
```bash
# Search by name
curl -X GET "http://localhost:3000/api/v1/performance-indicators?q=production&page=1&limit=10" \
  -H "Authorization: Bearer $JWT_TOKEN"

# Get root indicators only
curl -X GET "http://localhost:3000/api/v1/performance-indicators?has_parent=false" \
  -H "Authorization: Bearer $JWT_TOKEN"

# Get children of specific indicator
curl -X GET "http://localhost:3000/api/v1/performance-indicators?parent_id=clr_production_opt_123" \
  -H "Authorization: Bearer $JWT_TOKEN"
```

### 4. Get Indicator Statistics
```bash
curl -X GET http://localhost:3000/api/v1/performance-indicators/statistics \
  -H "Authorization: Bearer $JWT_TOKEN"
```

## Document Management

### 1. Create Document for Project
```bash
curl -X POST http://localhost:3000/api/v1/documents \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Project Requirements Document",
    "description": "Detailed requirements and specifications for the digital transformation project",
    "content": "# Project Requirements\n\n## Functional Requirements\n1. User authentication system\n2. Dashboard with KPI tracking\n3. Project management interface\n\n## Non-Functional Requirements\n1. Response time < 2 seconds\n2. 99.9% uptime\n3. Support for 1000 concurrent users",
    "project_id": "clr_project_123"
  }'
```

### 2. Create Document for Tenant
```bash
curl -X POST http://localhost:3000/api/v1/documents \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Company Policies",
    "description": "Updated company policies and procedures",
    "content": "# Company Policies\n\n## Remote Work Policy\n- Flexible working hours\n- Home office setup allowance\n\n## Code of Conduct\n- Professional behavior expectations\n- Conflict resolution procedures",
    "tenant_id": "clr_tenant_123"
  }'
```

### 3. Search Documents
```bash
# Search by content
curl -X GET "http://localhost:3000/api/v1/documents?q=requirements&page=1&limit=10" \
  -H "Authorization: Bearer $JWT_TOKEN"

# Filter by project
curl -X GET "http://localhost:3000/api/v1/documents?project_id=clr_project_123" \
  -H "Authorization: Bearer $JWT_TOKEN"

# Filter by tenant
curl -X GET "http://localhost:3000/api/v1/documents?tenant_id=clr_tenant_123" \
  -H "Authorization: Bearer $JWT_TOKEN"
```

## Advanced Scenarios

### 1. Complete Project Workflow
```bash
# 1. Create project
PROJECT_RESPONSE=$(curl -s -X POST http://localhost:3000/api/v1/projects \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "WORKFLOW001",
    "name": "Complete Workflow Demo",
    "description": "Demonstration of complete project workflow",
    "start_date": "2024-01-01",
    "status": "Planning"
  }')

PROJECT_ID=$(echo $PROJECT_RESPONSE | jq -r '.data.id')

# 2. Add initial status
curl -X POST http://localhost:3000/api/v1/projects/$PROJECT_ID/statuses \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "Requirements Gathering",
    "description": "Starting requirements gathering phase"
  }'

# 3. Create project document
curl -X POST http://localhost:3000/api/v1/documents \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Project Charter",
    "description": "Project charter and initial planning document",
    "content": "Project objectives, scope, and initial timeline",
    "project_id": "'$PROJECT_ID'"
  }'

# 4. Update to next status
curl -X POST http://localhost:3000/api/v1/projects/$PROJECT_ID/statuses \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "In Progress",
    "description": "Development phase started"
  }'

# 5. Get complete project details
curl -X GET http://localhost:3000/api/v1/projects/$PROJECT_ID \
  -H "Authorization: Bearer $JWT_TOKEN"
```

### 2. User Management Workflow
```bash
# 1. Create user
USER_RESPONSE=$(curl -s -X POST http://localhost:3000/api/v1/users \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "workflow.user@example.com",
    "password": "password123",
    "role_name": "user",
    "profile": {
      "first_name": "Workflow",
      "last_name": "User"
    }
  }')

USER_ID=$(echo $USER_RESPONSE | jq -r '.data.id')

# 2. Update user profile
curl -X PATCH http://localhost:3000/api/v1/users/$USER_ID \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "profile": {
      "phone": "+1-555-WORKFLOW",
      "city": "Demo City"
    }
  }'

# 3. Get user details
curl -X GET http://localhost:3000/api/v1/users/$USER_ID \
  -H "Authorization: Bearer $JWT_TOKEN"

# 4. Get user login history (will be empty for new user)
curl -X GET http://localhost:3000/api/v1/users/$USER_ID/login-history \
  -H "Authorization: Bearer $JWT_TOKEN"
```

### 3. Bulk Operations Example
```bash
# Get all active users
USERS=$(curl -s -X GET "http://localhost:3000/api/v1/users?active=true&limit=100" \
  -H "Authorization: Bearer $JWT_TOKEN")

# Get all projects in planning status
PLANNING_PROJECTS=$(curl -s -X GET "http://localhost:3000/api/v1/projects?status=Planning&limit=100" \
  -H "Authorization: Bearer $JWT_TOKEN")

# Get all root performance indicators
ROOT_INDICATORS=$(curl -s -X GET "http://localhost:3000/api/v1/performance-indicators?has_parent=false&limit=100" \
  -H "Authorization: Bearer $JWT_TOKEN")

echo "Active Users: $(echo $USERS | jq '.data.meta.total')"
echo "Planning Projects: $(echo $PLANNING_PROJECTS | jq '.data.meta.total')"
echo "Root Indicators: $(echo $ROOT_INDICATORS | jq '.data.meta.total')"
```

### 4. Error Handling Examples
```bash
# Try to create user with existing email (409 Conflict)
curl -X POST http://localhost:3000/api/v1/users \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "password123"
  }'

# Try to access resource without permission (403 Forbidden)
curl -X DELETE http://localhost:3000/api/v1/users/some-user-id \
  -H "Authorization: Bearer $INVALID_TOKEN"

# Try to create project with invalid data (400 Bad Request)
curl -X POST http://localhost:3000/api/v1/projects \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Project without required code"
  }'
```

### 5. Pagination Example
```bash
# Get first page of users
PAGE1=$(curl -s -X GET "http://localhost:3000/api/v1/users?page=1&limit=5" \
  -H "Authorization: Bearer $JWT_TOKEN")

# Check if there are more pages
HAS_NEXT=$(echo $PAGE1 | jq '.data.meta.hasNext')

if [ "$HAS_NEXT" = "true" ]; then
  # Get second page
  PAGE2=$(curl -s -X GET "http://localhost:3000/api/v1/users?page=2&limit=5" \
    -H "Authorization: Bearer $JWT_TOKEN")
  
  echo "Page 2 users: $(echo $PAGE2 | jq '.data.data | length')"
fi
```

## Testing with Different User Roles

### 1. Login as Different Users
```bash
# Login as superadmin
SUPERADMIN_TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "superadmin@example.com", "password": "superadmin123"}' | \
  jq -r '.data.access_token')

# Login as admin
ADMIN_TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "admin123"}' | \
  jq -r '.data.access_token')

# Login as regular user
USER_TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "user123"}' | \
  jq -r '.data.access_token')
```

### 2. Test Role-Based Access
```bash
# Superadmin can create performance indicators
curl -X POST http://localhost:3000/api/v1/performance-indicators \
  -H "Authorization: Bearer $SUPERADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Indicator", "description": "Test"}'

# Regular user cannot create performance indicators (403 Forbidden)
curl -X POST http://localhost:3000/api/v1/performance-indicators \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Indicator", "description": "Test"}'

# Regular user can only see their own projects
curl -X GET http://localhost:3000/api/v1/projects \
  -H "Authorization: Bearer $USER_TOKEN"
```

This comprehensive set of examples demonstrates the full capabilities of the API and provides practical guidance for integration and testing.