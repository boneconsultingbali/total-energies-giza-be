# Global Permission System

This documentation explains how to use the new global permission system that has been implemented to replace the individual `checkPermission` functions in each controller.

## Overview

The global permission system consists of:

1. **`@RequirePermission` decorator** - For method-level permission checking
2. **`PermissionGuard`** - Guard that automatically validates permissions
3. **Permission utility functions** - For complex permission logic

## Usage

### 1. Basic Usage with Decorator

```typescript
import { Controller, Get, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionGuard } from "../../common/guards/permission.guard";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";

@Controller("example")
@UseGuards(JwtAuthGuard, PermissionGuard) // Add both guards
export class ExampleController {
  @Get()
  @RequirePermission("example:read") // Specify required permission
  findAll() {
    return this.exampleService.findAll();
  }

  @Post()
  @RequirePermission("example:create")
  create(@Body() dto: CreateExampleDto) {
    return this.exampleService.create(dto);
  }
}
```

### 2. Complex Permission Logic

For scenarios where simple permission checking isn't enough, use the utility functions:

```typescript
import { checkUserPermission, checkUserHasAnyPermission } from '../../common/utils/permission.utils';

@Patch(':id/preferences')
updatePreferences(@Param('id') id: string, @Request() req) {
  // Users can update their own preferences, or users with admin permission
  if (req.user.id !== id) {
    checkUserPermission(req.user, 'user:update');
  }
  return this.service.updatePreferences(id, preferences);
}

@Get('special-data')
getSpecialData(@Request() req) {
  // User needs either admin or special access
  if (!checkUserHasAnyPermission(req.user, ['admin:read', 'special:access'])) {
    throw new ForbiddenException('Special access required');
  }
  return this.service.getSpecialData();
}
```

### 3. Migration from Old checkPermission

**Before:**

```typescript
@Get()
findAll(@Request() req) {
  this.checkPermission(req.user, 'resource:read');
  return this.service.findAll();
}

private checkPermission(user: any, permission: string) {
  if (!user.permissions.includes(permission)) {
    throw new ForbiddenException(`Insufficient permissions: ${permission} required`);
  }
}
```

**After:**

```typescript
@Controller('resource')
@UseGuards(JwtAuthGuard, PermissionGuard) // Add PermissionGuard to controller

@Get()
@RequirePermission('resource:read') // Add decorator
findAll() {
  return this.service.findAll(); // Remove permission check and req parameter
}

// Remove private checkPermission method
```

## Benefits

1. **Consistency** - Same permission checking logic across all modules
2. **Less Code** - No need for private `checkPermission` methods in each controller
3. **Declarative** - Permission requirements are clearly visible in decorators
4. **Maintainability** - Changes to permission logic only need to be made in one place
5. **Type Safety** - Better TypeScript support and IDE autocomplete

## Files Updated

The following controllers have been migrated to use the global permission system:

- `src/modules/project/project.controller.ts`
- `src/modules/user/user.controller.ts`
- `src/modules/document/document.controller.ts`

## New Files Created

- `src/common/decorators/require-permission.decorator.ts` - Permission decorator
- `src/common/guards/permission.guard.ts` - Permission guard
- `src/common/utils/permission.utils.ts` - Utility functions for complex scenarios
