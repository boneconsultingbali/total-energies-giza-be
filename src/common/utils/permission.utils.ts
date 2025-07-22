import { ForbiddenException } from "@nestjs/common";

/**
 * Utility function to check user permissions
 * Use this for complex permission logic that can't be handled by the @RequirePermission decorator
 */
export function checkUserPermission(user: any, permission: string): void {
  if (!user) {
    throw new ForbiddenException("User not authenticated");
  }

  if (!user.permissions || !Array.isArray(user.permissions)) {
    throw new ForbiddenException("User permissions not found");
  }

  if (!user.permissions.includes(permission)) {
    throw new ForbiddenException(
      `Insufficient permissions: ${permission} required`
    );
  }
}

/**
 * Check if user has any of the provided permissions
 */
export function checkUserHasAnyPermission(
  user: any,
  permissions: string[]
): boolean {
  if (!user || !user.permissions || !Array.isArray(user.permissions)) {
    return false;
  }

  return permissions.some((permission) =>
    user.permissions.includes(permission)
  );
}

/**
 * Check if user has all of the provided permissions
 */
export function checkUserHasAllPermissions(
  user: any,
  permissions: string[]
): boolean {
  if (!user || !user.permissions || !Array.isArray(user.permissions)) {
    return false;
  }

  return permissions.every((permission) =>
    user.permissions.includes(permission)
  );
}
