# User Service API

[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D14-brightgreen)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/express-4.x-lightgrey)](https://expressjs.com/)

## Table of Contents

- [Project Overview](#project-overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Database and Migrations](#database-and-migrations)
- [API Endpoints](#api-endpoints)
- [Folder Structure](#folder-structure)
- [Development Notes](#development-notes)
- [Contributing](#contributing)
- [License](#license)

---

## Project Overview

This is an **External User Service** that handles user authentication, user management, driver management, and related user operations. It's designed to be a standalone microservice that can be integrated with other services like booking systems.

---

## Features

- User registration and authentication (Passenger, Driver, Staff, Admin)
- **Password update and reset functionality for email-based registered passengers**
- Role and permission-based access control (RBAC)
- Passenger profile management, including self-delete
- Driver document uploads and approval workflow (pending/approved/rejected)
- Passenger and Driver rating flows
- Driver management with vehicle type support (mini, sedan, van, motorbike, bajaj)
- Basic rate limiting on auth endpoints
- Phone authentication with OTP
- Dispute management system

---

## Tech Stack

- Node.js
- Express.js
- MySQL / Sequelize ORM
- JWT Authentication
- Multer (file uploads)
- Postman (collection provided)

---

## Getting Started

### Prerequisites

- Node.js >= 14.x
- MySQL
- npm

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/rideshare-backend.git
cd rideshare-backend

# Install dependencies
npm install
```

### Configure Environment

Create a `.env` file in the project root:

```bash
DB_NAME=rideshare_db
DB_USER=root
DB_PASS=your_password
DB_HOST=127.0.0.1
DB_PORT=3306
JWT_SECRET=change_me
JWT_REFRESH_SECRET=your-refresh-secret-key
ACCESS_TOKEN_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d
# If you use the provided Postman baseUrl (4000), set PORT=4000
PORT=4000
# Enable Sequelize SQL logs (true/false)
SEQ_LOG=false

# SMS Configuration (for OTP functionality)
GEEZSMS_TOKEN=your-geezsms-token
```

### Start the Server

```bash
# Development (nodemon)
npm run dev

# or Production
npm start
```

The server starts at http://localhost:PORT (default 3000). All APIs are mounted under `/api`, e.g. `http://localhost:3000/api`.

---

## Environment Variables

- DB_NAME: Database name
- DB_USER: Database username
- DB_PASS: Database password
- DB_HOST: Database host (default 127.0.0.1)
- DB_PORT: Database port (default 3306)
- JWT_SECRET: Secret for JWT access token signing
- JWT_REFRESH_SECRET: Secret for JWT refresh token signing
- ACCESS_TOKEN_EXPIRES_IN: Access token expiration time (default: 15m)
- REFRESH_TOKEN_EXPIRES_IN: Refresh token expiration time (default: 7d)
- PORT: Server port (default 3000)
- SEQ_LOG: Enable Sequelize logging (true/false)
- GEEZSMS_TOKEN: Token for SMS OTP functionality

---

## Database and Migrations

- On server start, `sequelize.sync({ alter: true })` will auto-create/update tables, including:
  - `passengers.contract_id`
  - `wallets` table and relations

Optional manual scripts:

```bash
# Run migration helper
npm run migrate
# Seed roles/permissions/superadmin
npm run seed
```

Ensure MySQL is running and `.env` is configured before running migrations/seed.

---

## API Endpoints

Base URL: `http://localhost:PORT/api`

### Auth
- POST `/auth/passenger/register`
- POST `/auth/passenger/login`
- POST `/auth/passenger/reset-password` - Reset password with current password verification
- POST `/auth/driver/register`
- POST `/auth/driver/login`
- POST `/auth/staff/login`
- POST `/auth/admin/register`
- POST `/auth/admin/login`

#### Phone-based OTP (Passenger)
- POST `/auth/request-otp` — request OTP using `{ "phone": "09XXXXXXXX" }`
- POST `/auth/verify-otp` — verify using `{ "phone": "09XXXXXXXX", "otp": "123456" }` and receive access & refresh tokens
- POST `/auth/login` — login with `{ "phone": "09XXXXXXXX" }` (after verified) and receive access & refresh tokens
- POST `/auth/refresh-token` — refresh access token using refresh token

Example: Request OTP
```http
POST /api/auth/request-otp
Content-Type: application/json

{ "phone": "0912345678" }
```

Example: Verify OTP (returns access and refresh tokens)
```http
POST /api/auth/verify-otp
Content-Type: application/json

{ "phone": "0912345678", "otp": "123456" }
```
Response
```json
{
  "success": true,
  "message": "OTP verified successfully. Account activated.",
  "passenger": { "id": 1, "phone": "+251912345678" },
  "accessToken": "<ACCESS_TOKEN>",
  "refreshToken": "<REFRESH_TOKEN>"
}
```

Example: Refresh access token
```http
POST /api/auth/refresh-token
Content-Type: application/json

{ "refreshToken": "<REFRESH_TOKEN>" }
```
Response
```json
{
  "success": true,
  "message": "Tokens refreshed successfully",
  "accessToken": "<NEW_ACCESS_TOKEN>",
  "refreshToken": "<NEW_REFRESH_TOKEN>"
}
```

Use the access token for protected endpoints
```http
GET /api/passengers/profile/me
Authorization: Bearer <ACCESS_TOKEN>
```

#### Password Management
- POST `/auth/passenger/reset-password` — Reset password with current password verification
- POST `/passengers/update-password` — Update password (requires authentication)

Example: Reset password (no authentication required)
```http
POST /api/auth/passenger/reset-password
Content-Type: application/json

{ 
  "email": "user@example.com",
  "currentPassword": "oldpassword", 
  "newPassword": "newpassword123" 
}
```

Example: Update password (requires authentication)
```http
POST /api/passengers/update-password
Authorization: Bearer <JWT>
Content-Type: application/json

{ 
  "currentPassword": "oldpassword", 
  "newPassword": "newpassword123" 
}
```

### Passengers (admin)
- GET `/passengers`
- GET `/passengers/:id`
- PUT `/passengers/:id`
- DELETE `/passengers/:id`

### Passengers (self)
- GET `/passengers/profile/me`
- PUT `/passengers/profile/me`
- DELETE `/passengers/profile/me` (delete own account)
- POST `/passengers/update-password` - Update password (requires current password)
- POST `/passengers/rate-driver/:driverId`

### Drivers (admin)
- GET `/drivers`
- GET `/drivers/:id`
- PUT `/drivers/:id`
- DELETE `/drivers/:id`

### Drivers (self)
- GET `/drivers/profile/me`
- PUT `/drivers/profile/me`
- POST `/drivers/profile/me/toggle-availability`
- POST `/drivers/:id/documents` (form-data uploads)
- POST `/drivers/rate-passenger/:passengerId`

### Admins
- POST `/admins`
- GET `/admins`
- GET `/admins/:id`
- PUT `/admins/:id`
- DELETE `/admins/:id`
- POST `/admins/drivers/:driverId/approve`
- POST `/admins/drivers/:driverId/documents/approve`
- POST `/admins/drivers/:driverId/documents/reject`
- GET `/admins/drivers/pending-documents`
- GET `/admins/users/filter?role=driver|passenger|staff|admin`
- GET `/admins/staff?role=dispatcher`

### Roles
- POST `/roles`
- GET `/roles`
- GET `/roles/:id`
- PUT `/roles/:id`
- DELETE `/roles/:id`

### Permissions
- POST `/permissions`
- GET `/permissions`
- GET `/permissions/:id`
- PUT `/permissions/:id`
- DELETE `/permissions/:id`

---

## Folder Structure

```
.
├── config/
│   └── database.js
├── controllers/
├── middleware/
├── models/
├── postman/
│   └── rideshare.postman_collection.json
├── routes/
├── seed/
├── uploads/
├── server.js
├── package.json
└── README.md
```


## Contributing

Contributions are welcome. Please open an issue or submit a PR.

---

## License

MIT
