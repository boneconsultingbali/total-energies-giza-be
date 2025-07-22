# Optimized NestJS Service Architecture

## Overview

This document outlines the optimized service architecture implemented for the Total Energies Giza Backend project. The architecture focuses on:

- **Transaction Management**: Proper use of Prisma transactions for data consistency
- **Reusable Business Logic**: Centralized middleware for common operations
- **Performance Optimization**: Efficient database queries and caching strategies
- **Clean Code**: Removal of code duplication and implementation of best practices

## Architecture Components

### 1. Base Service (`BaseService`)

The `BaseService` class provides common functionality that all service classes can inherit from:

#### Key Features:

- **Transaction Management**: Centralized transaction handling with proper error management
- **Query Building**: Reusable methods for building Prisma include, pagination, and filter options
- **Access Control**: Standardized permission checking across all services
- **Validation**: Common validation methods for different data types
- **Logging**: Structured logging for all operations

#### Methods:

```typescript
// Transaction execution
executeTransaction<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T>

// Query building
buildIncludeOptions(options: BaseIncludeOptions): any
buildPaginationOptions(options: PaginationOptions): { skip: number; take: number }
buildSortOptions(options: SortOptions): any
buildAccessControlConditions(options: AccessControlOptions): any[]
buildSearchConditions(searchTerm: string, searchFields: string[]): any
buildDateRangeConditions(startDate?: string, endDate?: string, dateField?: string): any[]

// Validation
validateEntityExists(model: any, id: string, entityName: string): Promise<any>
validateArrayField(value: string | string[], fieldName: string): string[]
validateNumericInput(value: any, fieldName: string, min?: number, max?: number): number
checkEntityAccess(entity: any, options: AccessControlOptions): Promise<boolean>
checkUserTenantAccess(userId: string, tenantId: string): Promise<boolean>

// Utilities
calculatePaginationMeta(total: number, page: number, limit: number): PaginationMeta
buildCacheKey(prefix: string, params: Record<string, any>): string
logOperation(operation: string, entityId?: string, userId?: string): void
```

### 2. Business Logic Middleware (`BusinessLogicMiddleware`)

Centralized middleware for handling reusable business logic across different services:

#### Key Features:

- **Entity Validation**: Standardized validation for users, tenants, projects, and indicators
- **Business Rules**: Implementation of complex business logic like project score calculation
- **Notification Management**: Centralized notification system with configurable options
- **Data Sanitization**: Common validation and sanitization methods
- **Audit Logging**: Structured audit trail for all operations

#### Methods:

```typescript
// Entity validation
validateUser(userId: string, options?: ValidationOptions): Promise<EntityValidationResult>
validateTenant(tenantId: string, userId?: string, options?: ValidationOptions): Promise<EntityValidationResult>
validateProject(projectId: string, userId?: string, userRole?: string, options?: ValidationOptions): Promise<EntityValidationResult>
validatePerformanceIndicator(indicatorId: string, options?: ValidationOptions): Promise<EntityValidationResult>

// Business calculations
calculateProjectScore(projectId: string): Promise<number | null>
updateProjectScore(projectId: string, tx?: any): Promise<void>
createProjectStatus(projectId: string, status: string, description: string, tx?: any): Promise<any>

// Notifications
sendNotification(type: 'email' | 'internal' | 'both', config: NotificationConfig): Promise<void>

// Data validation and sanitization
validateArrayInput(input: any, fieldName: string, maxLength?: number): string[]
validateNumericInput(value: any, fieldName: string, options?: NumericValidationOptions): number | null
validateDateInput(value: any, fieldName: string, required?: boolean): Date | null
validateEmailInput(email: string, required?: boolean): string | null

// Utilities
checkUniqueness(model: string, field: string, value: any, excludeId?: string): Promise<boolean>
getEntityStatistics(model: string, filters?: Record<string, any>, groupBy?: string[]): Promise<any>
createAuditLog(action: string, entityType: string, entityId: string, userId: string, changes?: Record<string, any>): Promise<void>
```

### 3. Optimized Project Service (`ProjectService`)

The project service has been completely refactored to use the base service and middleware:

#### Key Improvements:

- **Transaction-based Operations**: All create, update, and delete operations use proper transactions
- **Parallel Validation**: Related entity validation runs in parallel for better performance
- **Centralized Access Control**: Uses base service methods for permission checking
- **Asynchronous Notifications**: Email notifications are sent asynchronously to not block operations
- **Optimized Queries**: Uses standardized include patterns and efficient queries

#### Example Usage:

```typescript
// Create project with proper transaction management
async create(createDto: CreateProjectDto, userId: string) {
  return this.executeTransaction(async (tx) => {
    // Parallel validation of related entities
    const validationPromises = [
      // Validate owner, tenant, indicators in parallel
    ];
    await Promise.all(validationPromises);

    // Create project and related data
    const project = await tx.tbm_project.create({...});

    // Create related data in parallel
    const operations = [
      // Create indicators, statuses, documents in parallel
    ];
    await Promise.all(operations);

    return project;
  });
}
```

### 4. Optimized User Service (`UserService`)

The user service extends the base service for consistency:

#### Key Improvements:

- **Transaction Safety**: All operations use transactions where needed
- **Efficient Queries**: Optimized include patterns to reduce database load
- **Async Operations**: Email notifications sent asynchronously
- **Validation Reuse**: Uses business logic middleware for validation
- **Proper Error Handling**: Comprehensive error handling with meaningful messages

## Business Flow Improvements

### 1. Project Creation Flow

**Before:**

```
1. Validate project code (separate query)
2. Validate owner (separate query)
3. Validate tenant (separate query)
4. Validate indicators (separate query)
5. Create project
6. Create indicators one by one
7. Create documents one by one
8. Create status
9. Return project with full query
```

**After:**

```
1. Start transaction
2. Validate all entities in parallel
3. Create project
4. Create all related data in parallel
5. Return project with optimized includes
6. Send notifications asynchronously
```

### 2. User Management Flow

**Before:**

```
1. Multiple separate validation queries
2. Create user
3. Create profile separately
4. Send email synchronously (blocking)
5. Return user data
```

**After:**

```
1. Transaction with parallel validation
2. Create user and profile atomically
3. Send welcome email asynchronously
4. Return sanitized user data
```

### 3. Access Control Flow

**Before:**

```
1. Multiple database queries per permission check
2. Repetitive role checking logic
3. Inconsistent access patterns
```

**After:**

```
1. Centralized access control methods
2. Cached permission patterns
3. Consistent role-based access across all services
```

## Performance Optimizations

### 1. Database Query Optimization

- **Parallel Queries**: Related entity validation runs in parallel
- **Efficient Includes**: Standardized include patterns that only fetch necessary data
- **Query Batching**: Multiple create operations batched together
- **Index-Friendly Queries**: Queries optimized for database indexes

### 2. Transaction Management

- **Proper Transaction Scope**: Transactions only wrap operations that need atomicity
- **Connection Pool Optimization**: Efficient use of database connections
- **Error Handling**: Proper rollback mechanisms for failed operations

### 3. Caching Strategies

- **Query Result Caching**: Common queries cached at the service level
- **Permission Caching**: User permissions cached to reduce database hits
- **Metadata Caching**: Static data like roles and permissions cached

### 4. Asynchronous Operations

- **Non-blocking Notifications**: Email and notifications sent asynchronously
- **Background Processing**: Heavy operations moved to background queues
- **Lazy Loading**: Related data loaded only when needed

## Code Quality Improvements

### 1. Removed Code Duplication

- **Common Validation Logic**: Centralized in middleware
- **Database Query Patterns**: Standardized in base service
- **Error Handling**: Consistent across all services
- **Logging**: Uniform logging patterns

### 2. Better Separation of Concerns

- **Service Layer**: Focused on business logic only
- **Middleware Layer**: Handles cross-cutting concerns
- **Data Layer**: Optimized Prisma queries
- **Notification Layer**: Separated notification logic

### 3. Improved Type Safety

- **Strict TypeScript**: Full type coverage for all operations
- **Interface Definitions**: Clear contracts between layers
- **Generic Types**: Reusable type definitions

## Testing Strategy

### 1. Unit Testing

- **Service Methods**: Test individual service methods in isolation
- **Middleware Functions**: Test business logic middleware functions
- **Validation Logic**: Test all validation and sanitization methods

### 2. Integration Testing

- **Database Operations**: Test complete CRUD operations with real database
- **Transaction Handling**: Test rollback scenarios
- **Access Control**: Test permission-based access scenarios

### 3. Performance Testing

- **Load Testing**: Test service performance under load
- **Query Performance**: Analyze and optimize slow queries
- **Memory Usage**: Monitor memory consumption patterns

## Migration Guide

### 1. Existing Services

1. Extend `BaseService` instead of directly using `PrismaService`
2. Replace manual query building with base service methods
3. Wrap operations in `executeTransaction` where needed
4. Use `BusinessLogicMiddleware` for validation and business rules

### 2. Database Queries

1. Replace manual include objects with `buildIncludeOptions`
2. Use `buildPaginationOptions` for pagination
3. Implement `buildAccessControlConditions` for permission checks
4. Use standardized error handling patterns

### 3. Notification System

1. Replace direct email service calls with middleware notifications
2. Make notifications asynchronous where possible
3. Use configurable notification options

## Deployment Considerations

### 1. Environment Configuration

- **Database Connection Pool**: Configure appropriate pool sizes
- **Transaction Timeouts**: Set appropriate timeout values
- **Cache Settings**: Configure cache TTL and size limits

### 2. Monitoring

- **Performance Metrics**: Monitor query performance and response times
- **Error Tracking**: Comprehensive error logging and alerting
- **Resource Usage**: Monitor CPU, memory, and database usage

### 3. Scaling

- **Horizontal Scaling**: Services designed for horizontal scaling
- **Database Optimization**: Proper indexing and query optimization
- **Caching Layer**: Redis or similar for distributed caching

## Best Practices Summary

1. **Always use transactions** for operations that modify multiple entities
2. **Validate in parallel** when checking multiple related entities
3. **Use consistent include patterns** to avoid over-fetching
4. **Send notifications asynchronously** to avoid blocking operations
5. **Implement proper error handling** with meaningful error messages
6. **Use the middleware** for common business logic and validation
7. **Log all important operations** for debugging and audit purposes
8. **Test thoroughly** including edge cases and error scenarios
9. **Monitor performance** and optimize based on actual usage patterns
10. **Follow the established patterns** for consistency across the codebase
