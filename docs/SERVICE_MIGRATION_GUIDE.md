# Service Migration Guide

This guide demonstrates how to migrate existing services to use the optimized architecture with BaseService and BusinessLogicMiddleware.

## Migration Pattern

### 1. Extend BaseService

Replace direct PrismaService injection with BaseService extension:

**Before:**

```typescript
@Injectable()
export class OldService {
  constructor(private prisma: PrismaService) {}
}
```

**After:**

```typescript
@Injectable()
export class NewService extends BaseService {
  constructor(
    prisma: PrismaService,
    private businessLogic: BusinessLogicMiddleware
  ) {
    super(prisma);
  }
}
```

### 2. Use Transactions for Data Operations

Replace direct Prisma calls with transaction-wrapped operations:

**Before:**

```typescript
async create(createDto: CreateDto) {
  return this.prisma.entity.create({
    data: createDto,
  });
}
```

**After:**

```typescript
async create(createDto: CreateDto) {
  this.logOperation('Creating entity', undefined, createDto.name);

  return this.executeTransaction(async (tx) => {
    // Validation using business logic
    const isUnique = await this.businessLogic.checkUniqueness(
      'entity_table',
      'unique_field',
      createDto.unique_field
    );

    if (!isUnique) {
      throw new ConflictException("Entity already exists");
    }

    // Create entity with optimized includes
    const entity = await tx.entity.create({
      data: createDto,
      include: this.buildIncludeOptions({
        relations: true,
        _count: true,
      }),
    });

    // Audit logging
    await this.businessLogic.createAuditLog(
      'CREATE',
      'ENTITY',
      entity.id,
      'system'
    );

    return entity;
  });
}
```

### 3. Optimize Query Operations

Use built-in pagination and search utilities:

**Before:**

```typescript
async findAll(query: any) {
  const { page = 1, limit = 10, search } = query;
  const skip = (page - 1) * limit;

  const where = search ? {
    OR: [
      { name: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ],
  } : {};

  const [items, total] = await Promise.all([
    this.prisma.entity.findMany({
      where,
      skip,
      take: limit,
    }),
    this.prisma.entity.count({ where }),
  ]);

  return { items, total, page, limit };
}
```

**After:**

```typescript
async findAll(query: SearchQuery): Promise<PaginatedResult<any>> {
  const {
    page = 1,
    limit = 10,
    search,
    sortBy = 'created_at',
    sortOrder = 'desc',
  } = query;

  this.logOperation('Finding all entities');

  const pageNum = typeof page === 'string' ? parseInt(page, 10) : page;
  const limitNum = typeof limit === 'string' ? parseInt(limit, 10) : limit;

  const pagination = this.buildPaginationOptions({ page: pageNum, limit: limitNum });
  const searchConditions = search ?
    this.buildSearchConditions(search, ['name', 'description']) : {};
  const orderBy = this.buildSortOptions({ sortBy, sortOrder });

  const [entities, total] = await Promise.all([
    this.prisma.entity.findMany({
      where: searchConditions,
      ...pagination,
      orderBy,
      include: this.buildIncludeOptions({
        relations: true,
        _count: true,
      }),
    }),
    this.prisma.entity.count({ where: searchConditions }),
  ]);

  return {
    data: entities,
    meta: this.calculatePaginationMeta(total, pageNum, limitNum),
  };
}
```

### 4. Use Business Logic Validation

Replace manual validation with centralized business logic:

**Before:**

```typescript
async update(id: string, updateDto: UpdateDto) {
  const existing = await this.prisma.entity.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundException('Entity not found');
  }

  if (updateDto.name && updateDto.name !== existing.name) {
    const duplicate = await this.prisma.entity.findFirst({
      where: { name: updateDto.name, id: { not: id } },
    });
    if (duplicate) {
      throw new ConflictException('Name already exists');
    }
  }

  return this.prisma.entity.update({
    where: { id },
    data: updateDto,
  });
}
```

**After:**

```typescript
async update(id: string, updateDto: UpdateDto) {
  this.logOperation('Updating entity', id);

  return this.executeTransaction(async (tx) => {
    const existing = await this.validateEntityExists(tx.entity, id, 'Entity');

    // Use business logic for uniqueness check
    if (updateDto.name && updateDto.name !== existing.name) {
      const isUnique = await this.businessLogic.checkUniqueness(
        'entity_table',
        'name',
        updateDto.name,
        id
      );

      if (!isUnique) {
        throw new ConflictException("Name already exists");
      }
    }

    const updated = await tx.entity.update({
      where: { id },
      data: updateDto,
      include: this.buildIncludeOptions({
        relations: true,
        _count: true,
      }),
    });

    await this.businessLogic.createAuditLog(
      'UPDATE',
      'ENTITY',
      id,
      'system',
      updateDto
    );

    return updated;
  });
}
```

## Key Benefits

### 1. Transaction Management

- **Automatic rollback** on errors
- **Data consistency** across related operations
- **Performance optimization** through batched operations

### 2. Centralized Business Logic

- **Reusable validation** functions
- **Consistent error handling**
- **Audit logging** across all operations

### 3. Query Optimization

- **Standardized pagination**
- **Efficient search** with configurable fields
- **Optimized includes** to prevent N+1 queries

### 4. Error Handling

- **Consistent error messages**
- **Proper HTTP status codes**
- **Detailed logging** for debugging

## Implementation Checklist

For each service migration:

- [ ] Extend BaseService instead of direct PrismaService injection
- [ ] Inject BusinessLogicMiddleware for shared business logic
- [ ] Wrap data operations in executeTransaction()
- [ ] Use buildIncludeOptions() for optimized queries
- [ ] Replace manual validation with business logic methods
- [ ] Add proper error handling with appropriate HTTP status codes
- [ ] Implement audit logging for all CRUD operations
- [ ] Use standardized pagination and search utilities
- [ ] Add operation logging for debugging and monitoring

## Testing the Migration

After migrating a service:

1. **Unit Tests**: Verify all methods work with mocked dependencies
2. **Integration Tests**: Test database operations with real Prisma client
3. **Performance Tests**: Compare query performance before and after
4. **Error Handling Tests**: Verify proper error responses and rollbacks

## Example Service Structure

```typescript
@Injectable()
export class ExampleService extends BaseService {
  constructor(
    prisma: PrismaService,
    private businessLogic: BusinessLogicMiddleware
  ) {
    super(prisma);
  }

  async create(createDto: CreateDto) {
    return this.executeTransaction(async (tx) => {
      // Validation
      // Creation with includes
      // Audit logging
    });
  }

  async findAll(query: SearchQuery) {
    // Pagination and search utilities
    // Optimized queries with includes
  }

  async findOne(id: string) {
    // Entity validation
    // Optimized single entity query
  }

  async update(id: string, updateDto: UpdateDto) {
    return this.executeTransaction(async (tx) => {
      // Entity validation
      // Business logic validation
      // Update with audit logging
    });
  }

  async remove(id: string) {
    return this.executeTransaction(async (tx) => {
      // Dependency checks
      // Safe deletion
      // Audit logging
    });
  }
}
```

This pattern ensures consistency, performance, and maintainability across all services.
