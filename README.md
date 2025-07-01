# NestJS User Management API

A comprehensive REST API built with NestJS for user management, project tracking, performance indicators (KPIs), and document management with role-based access control.

## 🚀 Features

### 🔐 Authentication & Security
- **JWT Authentication**: Secure token-based authentication
- **Role-Based Access Control**: Granular permissions system (Superadmin, Admin, User)
- **Login Tracking**: Failed attempt monitoring and account locking
- **Rate Limiting**: Protection against abuse (10 requests/minute)
- **Input Validation**: Comprehensive request validation
- **Audit Logging**: Complete request/response logging

### 👥 User Management
- **Complete CRUD**: Create, read, update, delete users
- **Profile Management**: Detailed user profiles with preferences
- **Account Management**: Activate/deactivate, unlock accounts
- **User Anonymization**: GDPR-compliant data anonymization
- **Search & Filtering**: Advanced search with pagination

### 📊 Performance Indicators (KPIs)
- **Hierarchical Structure**: Parent-child indicator relationships
- **CRUD Operations**: Full management of performance indicators
- **Project Integration**: Link indicators to projects with scoring
- **Statistics**: Comprehensive indicator analytics

### 🎯 Project Management
- **Full Lifecycle**: Create, track, and manage projects
- **KPI Integration**: Assign and score performance indicators
- **Status Tracking**: Complete project status history
- **Document Linking**: Associate documents with projects
- **Role-Based Access**: Users see only relevant projects

### 📄 Document Management
- **Project Documents**: Link documents to specific projects
- **Tenant Organization**: Organize documents by tenant
- **Content Search**: Full-text search capabilities
- **Access Control**: Role-based document access

### 🏢 Multi-Tenant Support
- **Tenant Isolation**: Data separation by tenant
- **Tenant Management**: Complete tenant CRUD operations
- **User Assignment**: Assign users to tenants

## 🛠️ Technology Stack

- **Framework**: NestJS (Node.js)
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT with Passport
- **Validation**: Class Validator & Class Transformer
- **Logging**: Winston
- **Rate Limiting**: NestJS Throttler
- **API Documentation**: Comprehensive REST API docs

## 📋 Prerequisites

- Node.js (v18 or higher)
- PostgreSQL (v13 or higher)
- npm or yarn

## 🚀 Quick Start

### 1. Clone and Install
```bash
git clone <repository-url>
cd nestjs-user-management-api
npm install
```

### 2. Environment Setup
Create a `.env` file in the root directory:
```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/user_management_db"

# JWT
JWT_SECRET="your-super-secret-jwt-key-here"
JWT_EXPIRES_IN="7d"

# Security
MAX_LOGIN_ATTEMPTS=5
LOCK_TIME=30

# Application
PORT=3000
NODE_ENV=development
FRONTEND_URL="http://localhost:3000"
```

### 3. Database Setup
```bash
# Generate Prisma client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate

# Seed the database with sample data
npm run seed
```

### 4. Start the Application
```bash
# Development mode
npm run start:dev

# Production mode
npm run build
npm run start:prod
```

The API will be available at `http://localhost:3000/api/v1`

## 📚 API Documentation

### Base URL
```
http://localhost:3000/api/v1
```

### Default Users
After seeding, you can use these accounts:
```
Superadmin: superadmin@example.com (password: superadmin123)
Admin: admin@example.com (password: admin123)
User: user@example.com (password: user123)
Manager: manager@example.com (password: manager123)
Analyst: analyst@example.com (password: analyst123)
```

### Quick API Test
```bash
# Login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "admin123"}'

# Get current user (replace TOKEN with actual token)
curl -X GET http://localhost:3000/api/v1/auth/me \
  -H "Authorization: Bearer TOKEN"

# Get users
curl -X GET http://localhost:3000/api/v1/users \
  -H "Authorization: Bearer TOKEN"
```

## 📖 Comprehensive Documentation

- **[Complete API Documentation](docs/API_DOCUMENTATION.md)** - Full API reference with all endpoints
- **[API Examples](docs/API_EXAMPLES.md)** - Practical usage examples and workflows
- **[Postman Collection](docs/POSTMAN_COLLECTION.json)** - Import into Postman for testing

## 🔑 Key API Endpoints

### Authentication
- `POST /auth/login` - User login
- `GET /auth/me` - Get current user
- `POST /auth/change-password` - Change password
- `POST /auth/forgot-password` - Request password reset

### Users
- `GET /users` - List users (paginated, searchable)
- `POST /users` - Create user
- `GET /users/:id` - Get user details
- `PATCH /users/:id` - Update user
- `DELETE /users/:id` - Delete user

### Projects
- `GET /projects` - List projects (paginated, filtered)
- `POST /projects` - Create project with KPIs
- `GET /projects/:id` - Get project details
- `PUT /projects/:id/indicators/:indicatorId/score` - Update KPI score
- `POST /projects/:id/statuses` - Add status update

### Performance Indicators
- `GET /performance-indicators/hierarchy` - Get indicator hierarchy
- `POST /performance-indicators` - Create indicator (Admin only)
- `GET /performance-indicators/statistics` - Get statistics

### Documents
- `GET /documents` - List documents (filtered by project/tenant)
- `POST /documents` - Create document
- `GET /documents/:id` - Get document details

## 🔐 Permissions System

### Roles
- **Superadmin**: Full system access, all permissions
- **Admin**: User management, tenant/project management, KPIs
- **User**: Basic read access, own profile management, own projects

### Key Permissions
- `user:create`, `user:read`, `user:update`, `user:delete`
- `project:create`, `project:read`, `project:update`, `project:delete`
- `document:create`, `document:read`, `document:update`, `document:delete`
- `indicator:create`, `indicator:read`, `indicator:update`, `indicator:delete`

## 📊 Database Schema

The application uses a comprehensive database schema with:
- **User Management**: Users, profiles, roles, permissions
- **Security**: Login logs, user sessions, password reset tokens
- **Projects**: Projects with KPI tracking and status history
- **Performance Indicators**: Hierarchical KPI structure
- **Documents**: Project and tenant document management
- **Multi-tenancy**: Tenant-based data organization

## 🧪 Testing

### Run Tests
```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

### Manual Testing
Use the provided Postman collection or curl examples in the documentation.

## 🚀 Deployment

### Production Build
```bash
npm run build
npm run start:prod
```

### Environment Variables for Production
```env
NODE_ENV=production
DATABASE_URL="your-production-database-url"
JWT_SECRET="your-production-jwt-secret"
PORT=3000
```

## 📈 Performance Features

- **Pagination**: All list endpoints support pagination
- **Search**: Full-text search across relevant fields
- **Filtering**: Advanced filtering options
- **Efficient Queries**: Optimized database queries with proper joins
- **Caching**: Automatic score calculation and statistics caching

## 🔧 Development

### Project Structure
```
src/
├── common/           # Shared utilities, guards, interceptors
├── database/         # Prisma configuration
├── modules/          # Feature modules
│   ├── auth/         # Authentication
│   ├── user/         # User management
│   ├── project/      # Project management
│   ├── performance-indicator/  # KPI management
│   └── document/     # Document management
└── main.ts          # Application entry point

prisma/
├── schema.prisma    # Database schema
└── seeders/         # Database seeders
```

### Available Scripts
```bash
npm run start:dev     # Development mode with hot reload
npm run build         # Build for production
npm run start:prod    # Production mode
npm run lint          # Run ESLint
npm run format        # Format code with Prettier
npm run prisma:studio # Open Prisma Studio
npm run seed          # Seed database
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the UNLICENSED License.

## 🆘 Support

For support and questions:
1. Check the [API Documentation](docs/API_DOCUMENTATION.md)
2. Review [API Examples](docs/API_EXAMPLES.md)
3. Use the [Postman Collection](docs/POSTMAN_COLLECTION.json) for testing
4. Create an issue in the repository

## 🎯 Roadmap

- [ ] Email notifications for password reset
- [ ] File upload for documents
- [ ] Advanced reporting and analytics
- [ ] API versioning
- [ ] GraphQL support
- [ ] Real-time notifications
- [ ] Advanced audit logging
- [ ] Data export functionality

---

**Built with ❤️ using NestJS, Prisma, and PostgreSQL**