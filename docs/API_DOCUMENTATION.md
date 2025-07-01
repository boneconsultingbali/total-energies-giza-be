# NestJS User Management API Documentation

## Table of Contents
1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Base URL & Response Format](#base-url--response-format)
4. [Error Handling](#error-handling)
5. [Data Models](#data-models)
6. [API Endpoints](#api-endpoints)
   - [Authentication](#authentication-endpoints)
   - [Users](#users-endpoints)
   - [Performance Indicators](#performance-indicators-endpoints)
   - [Projects](#projects-endpoints)
   - [Documents](#documents-endpoints)
7. [Permissions & Roles](#permissions--roles)
8. [Examples](#examples)

## Overview

This is a comprehensive REST API built with NestJS for user management, project tracking, performance indicators (KPIs), and document management. The API supports role-based access control with three main roles: Superadmin, Admin, and User.

### Key Features
- **User Management**: Complete CRUD operations with role-based access
- **Authentication**: JWT-based authentication with login tracking
- **Project Management**: Full project lifecycle with KPI tracking
- **Performance Indicators**: Hierarchical KPI system with scoring
- **Document Management**: File organization by projects and tenants
- **Multi-tenant Support**: Tenant-based data isolation
- **Security**: Rate limiting, input validation, and comprehensive logging

## Authentication

The API uses JWT (JSON Web Token) for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

### Default Users
```
Superadmin: superadmin@example.com (password: superadmin123)
Admin: admin@example.com (password: admin123)
User: user@example.com (password: user123)
Manager: manager@example.com (password: manager123)
Analyst: analyst@example.com (password: analyst123)
```

## Base URL & Response Format

**Base URL**: `http://localhost:3000/api/v1`

### Standard Response Format
```json
{
  "success": true,
  "data": {}, // Response data
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Paginated Response Format
```json
{
  "success": true,
  "data": {
    "data": [], // Array of items
    "meta": {
      "total": 100,
      "page": 1,
      "limit": 10,
      "totalPages": 10,
      "hasNext": true,
      "hasPrev": false
    }
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Error Handling

### Error Response Format
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Error description",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "path": "/api/v1/endpoint"
}
```

### Common HTTP Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `422` - Validation Error
- `429` - Too Many Requests
- `500` - Internal Server Error

## Data Models

### User Model
```typescript
interface User {
  id: string;
  email: string;
  is_active: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  last_login?: string;
  login_attempts: number;
  locked_until?: string;
  role_name?: string;
  role?: Role;
  profile?: Profile;
  tenant_id?: string;
  tenant?: Tenant;
}
```

### Profile Model
```typescript
interface Profile {
  id: string;
  first_name?: string;
  last_name?: string;
  avatar?: string;
  phone?: string;
  birth_date?: string;
  gender?: string;
  country?: string;
  city?: string;
  address?: string;
  postal_code?: string;
  preferences?: object;
  created_at: string;
  updated_at: string;
}
```

### Role Model
```typescript
interface Role {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  permissions: RolePermission[];
}
```

### Project Model
```typescript
interface Project {
  id: string;
  code: string;
  name: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  status?: string;
  score?: number;
  created_at: string;
  updated_at: string;
  tenant_id?: string;
  tenant?: Tenant;
  owner_id?: string;
  owner?: User;
  indicators: ProjectIndicator[];
  statuses: ProjectStatus[];
  documents: Document[];
}
```

### Performance Indicator Model
```typescript
interface PerformanceIndicator {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
  parent_id?: string;
  parent?: PerformanceIndicator;
  children: PerformanceIndicator[];
}
```

### Document Model
```typescript
interface Document {
  id: string;
  name: string;
  description?: string;
  content?: string;
  created_at: string;
  updated_at: string;
  tenant_id?: string;
  tenant?: Tenant;
  project_id?: string;
  project?: Project;
}
```

## API Endpoints

## Authentication Endpoints

### POST /auth/login
Authenticate user and get JWT token.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "user-id",
      "email": "user@example.com",
      "role": {
        "name": "user"
      },
      "permissions": ["user:read", "profile:read"],
      "profile": {
        "first_name": "John",
        "last_name": "Doe"
      }
    }
  }
}
```

### GET /auth/me
Get current user information.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "user-id",
    "email": "user@example.com",
    "role": {
      "name": "user"
    },
    "permissions": ["user:read", "profile:read"],
    "profile": {
      "first_name": "John",
      "last_name": "Doe"
    }
  }
}
```

### POST /auth/forgot-password
Request password reset.

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

### POST /auth/reset-password
Reset password with token.

**Request Body:**
```json
{
  "token": "reset-token",
  "password": "newpassword123"
}
```

### POST /auth/change-password
Change current password.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "currentPassword": "oldpassword123",
  "newPassword": "newpassword123"
}
```

### POST /auth/logout
Logout and invalidate token.

**Headers:** `Authorization: Bearer <token>`

### GET /auth/login-history
Get user's login history.

**Headers:** `Authorization: Bearer <token>`

## Users Endpoints

### POST /users
Create a new user.

**Required Permission:** `user:create`

**Request Body:**
```json
{
  "email": "newuser@example.com",
  "password": "password123",
  "role_name": "user",
  "is_active": true,
  "profile": {
    "first_name": "John",
    "last_name": "Doe",
    "phone": "+1-555-0123",
    "country": "United States",
    "city": "New York"
  }
}
```

### GET /users
Get paginated list of users.

**Required Permission:** `user:read`

**Query Parameters:**
- `page` (number, default: 1)
- `limit` (number, default: 10, max: 100)
- `search` or `q` (string) - Search in email, name, role
- `role` (string) - Filter by role
- `active` (boolean) - Filter by active status
- `sortBy` (string) - Sort field
- `sortOrder` (string) - 'asc' or 'desc'

**Example:** `GET /users?page=1&limit=10&role=admin&active=true&q=john`

### GET /users/:id
Get user by ID.

**Required Permission:** `user:read`

### PATCH /users/:id
Update user.

**Required Permission:** `user:update`

**Request Body:**
```json
{
  "email": "updated@example.com",
  "role_name": "admin",
  "is_active": false,
  "profile": {
    "first_name": "Updated",
    "last_name": "Name"
  }
}
```

### DELETE /users/:id
Soft delete user.

**Required Permission:** `user:delete`

### POST /users/:id/anonymize
Anonymize user data.

**Required Permission:** `user:anonymize`

### POST /users/:id/activate
Activate user account.

**Required Permission:** `user:activate`

### POST /users/:id/deactivate
Deactivate user account.

**Required Permission:** `user:activate`

### POST /users/:id/unlock
Unlock user account.

**Required Permission:** `user:unlock`

### GET /users/:id/login-history
Get user's login history.

**Required Permission:** `user:view-logs`

### PATCH /users/:id/preferences
Update user preferences.

**Permission:** Own user or `user:update`

**Request Body:**
```json
{
  "theme": "dark",
  "language": "en",
  "notifications": {
    "email": true,
    "push": false
  }
}
```

### GET /users/roles/available
Get available roles for user creation.

**Required Permission:** Based on user role

## Performance Indicators Endpoints

### POST /performance-indicators
Create performance indicator.

**Required Permission:** Admin/Superadmin only

**Request Body:**
```json
{
  "name": "Production Efficiency",
  "description": "Measure production efficiency metrics",
  "parent_id": "parent-indicator-id"
}
```

### GET /performance-indicators
Get paginated list of performance indicators.

**Required Permission:** Admin/Superadmin only

**Query Parameters:**
- `page`, `limit`, `search`, `sortBy`, `sortOrder` (standard pagination)
- `parent_id` (string) - Filter by parent
- `has_parent` (boolean) - Filter by parent existence

### GET /performance-indicators/hierarchy
Get hierarchical view of all indicators.

**Required Permission:** Admin/Superadmin only

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "root-id",
      "name": "Production optimization",
      "description": "Optimize production processes",
      "children": [
        {
          "id": "child-id",
          "name": "Deliver Profitable Project",
          "description": "Ensure project profitability",
          "children": []
        }
      ]
    }
  ]
}
```

### GET /performance-indicators/statistics
Get indicator statistics.

**Required Permission:** Admin/Superadmin only

### GET /performance-indicators/available-parents
Get available parent indicators.

**Required Permission:** Admin/Superadmin only

**Query Parameters:**
- `exclude` (string) - Exclude specific indicator ID

### GET /performance-indicators/:id
Get indicator by ID.

**Required Permission:** Admin/Superadmin only

### PATCH /performance-indicators/:id
Update performance indicator.

**Required Permission:** Admin/Superadmin only

### DELETE /performance-indicators/:id
Delete performance indicator.

**Required Permission:** Admin/Superadmin only

## Projects Endpoints

### POST /projects
Create a new project.

**Required Permission:** `project:create`

**Request Body:**
```json
{
  "code": "PROJ001",
  "name": "Digital Transformation",
  "description": "Company-wide digital transformation initiative",
  "start_date": "2024-01-01",
  "end_date": "2024-12-31",
  "status": "Planning",
  "tenant_id": "tenant-id",
  "owner_id": "user-id",
  "indicators": [
    {
      "indicator_id": "indicator-id",
      "score": 75
    }
  ]
}
```

### GET /projects
Get paginated list of projects.

**Required Permission:** `project:read`

**Query Parameters:**
- Standard pagination parameters
- `status` (string) - Filter by status
- `owner_id` (string) - Filter by owner
- `tenant_id` (string) - Filter by tenant

**Note:** Users can only see projects they own or are part of their tenant.

### GET /projects/statistics
Get project statistics.

**Required Permission:** `project:read`

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
      { "owner_id": "user-1", "_count": 10 },
      { "owner_id": "user-2", "_count": 15 }
    ],
    "recent_projects": [
      {
        "id": "project-id",
        "code": "PROJ001",
        "name": "Project Name",
        "status": "In Progress",
        "score": 85,
        "created_at": "2024-01-15T10:30:00.000Z"
      }
    ]
  }
}
```

### GET /projects/:id
Get project details.

**Required Permission:** `project:read`

**Response includes:**
- Complete project information
- Associated KPIs with scores
- Status history
- Documents
- Owner and tenant details

### PATCH /projects/:id
Update project.

**Required Permission:** `project:update`

**Request Body:** Same as create, all fields optional

### DELETE /projects/:id
Delete project.

**Required Permission:** `project:delete`

**Note:** Users can only delete projects they own.

### POST /projects/:id/statuses
Add status update to project.

**Required Permission:** `project:update`

**Request Body:**
```json
{
  "status": "In Progress",
  "description": "Development phase started"
}
```

### GET /projects/:id/statuses
Get project status history.

**Required Permission:** `project:read`

### PUT /projects/:id/indicators/:indicatorId/score
Update KPI score for project.

**Required Permission:** `project:update`

**Request Body:**
```json
{
  "score": 85
}
```

**Note:** Project overall score is automatically recalculated.

## Documents Endpoints

### POST /documents
Create a new document.

**Required Permission:** `document:create`

**Request Body:**
```json
{
  "name": "Project Requirements",
  "description": "Detailed project requirements document",
  "content": "Document content here...",
  "tenant_id": "tenant-id",
  "project_id": "project-id"
}
```

### GET /documents
Get paginated list of documents.

**Required Permission:** `document:read`

**Query Parameters:**
- Standard pagination parameters
- `tenant_id` (string) - Filter by tenant
- `project_id` (string) - Filter by project

**Note:** Users can only see documents from their tenant or projects they own.

### GET /documents/:id
Get document by ID.

**Required Permission:** `document:read`

### PATCH /documents/:id
Update document.

**Required Permission:** `document:update`

### DELETE /documents/:id
Delete document.

**Required Permission:** `document:delete`

## Permissions & Roles

### Role Hierarchy
1. **Superadmin**: Full system access, all permissions
2. **Admin**: User management, tenant/project management, performance indicators
3. **User**: Basic read access, own profile management, own projects

### Key Permissions
- **User Management**: `user:create`, `user:read`, `user:update`, `user:delete`, `user:anonymize`, `user:activate`, `user:unlock`, `user:view-logs`
- **Role Management**: `role:create`, `role:read`, `role:update`, `role:delete`, `permission:read`, `permission:assign`
- **System**: `system:admin`, `system:logs`, `system:monitoring`
- **Tenant Management**: `tenant:create`, `tenant:read`, `tenant:update`, `tenant:delete`
- **Project Management**: `project:create`, `project:read`, `project:update`, `project:delete`
- **Document Management**: `document:create`, `document:read`, `document:update`, `document:delete`
- **Performance Indicators**: `indicator:create`, `indicator:read`, `indicator:update`, `indicator:delete`
- **Profile**: `profile:read`, `profile:update`

## Examples

### Complete Project Creation Workflow

1. **Login**
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "admin123"
  }'
```

2. **Create Project with KPIs**
```bash
curl -X POST http://localhost:3000/api/v1/projects \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "PROJ001",
    "name": "Digital Transformation",
    "description": "Company-wide digital transformation initiative",
    "start_date": "2024-01-01",
    "end_date": "2024-12-31",
    "status": "Planning",
    "indicators": [
      {
        "indicator_id": "production-optimization-id",
        "score": 75
      }
    ]
  }'
```

3. **Update KPI Score**
```bash
curl -X PUT http://localhost:3000/api/v1/projects/project-id/indicators/indicator-id/score \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"score": 85}'
```

4. **Add Status Update**
```bash
curl -X POST http://localhost:3000/api/v1/projects/project-id/statuses \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "In Progress",
    "description": "Development phase started"
  }'
```

5. **Create Document**
```bash
curl -X POST http://localhost:3000/api/v1/documents \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Project Requirements",
    "description": "Detailed requirements",
    "content": "Requirements content...",
    "project_id": "project-id"
  }'
```

### Search and Filter Examples

**Search users:**
```
GET /api/v1/users?q=john&role=admin&active=true&page=1&limit=10
```

**Search projects:**
```
GET /api/v1/projects?q=digital&status=Planning&owner_id=user-id
```

**Search documents:**
```
GET /api/v1/documents?q=requirements&project_id=project-id
```

**Get performance indicator hierarchy:**
```
GET /api/v1/performance-indicators/hierarchy
```

### Rate Limiting
- **Default**: 10 requests per minute per IP
- **Headers**: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

### Security Features
- **JWT Authentication**: Secure token-based authentication
- **Role-Based Access Control**: Granular permissions system
- **Input Validation**: Comprehensive request validation
- **Rate Limiting**: Protection against abuse
- **Login Tracking**: Failed attempt monitoring and account locking
- **Audit Logging**: Complete request/response logging
- **Data Sanitization**: XSS and injection protection

This API provides a complete, production-ready solution for user management, project tracking, and document organization with enterprise-grade security and scalability features.