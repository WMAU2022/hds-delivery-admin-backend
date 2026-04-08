# HDS Delivery Admin Backend

Backend API for Workout Meals HDS delivery system integration.

## Quick Start

### 1. Setup

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Edit .env with your database and HDS credentials
```

### 2. Database

```bash
# PostgreSQL must be running on your machine
# Install if needed: brew install postgresql

# Create database and tables
npm run migrate
```

### 3. Start Server

```bash
# Development (with auto-reload)
npm run dev

# Or production
npm start
```

Server runs on `http://localhost:3001`

---

## API Endpoints

### Regions

**List all regions**
```
GET /api/regions
```

Response:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "ACT - Canberra Metro",
      "zone_code": "CMEET",
      "delivery_hours": "AM (6am-12pm)",
      "enabled": true,
      "synced_at": "2026-04-01T02:00:00Z",
      "schedules": [
        {
          "id": 1,
          "cutoff_day": "Wednesday",
          "pack_day": "Thursday",
          "delivery_day": "Saturday",
          "hours": "AM",
          "enabled": true,
          "is_default": true
        }
      ]
    }
  ],
  "count": 1
}
```

**Get single region**
```
GET /api/regions/:id
```

**Toggle region (enable/disable)**
```
PUT /api/regions/:id/toggle
```

**Enable region**
```
PUT /api/regions/:id/enable
```

**Disable region**
```
PUT /api/regions/:id/disable
```

**Bulk enable regions**
```
POST /api/regions/bulk/enable
Body: { "ids": [1, 2, 3] }
```

**Bulk disable regions**
```
POST /api/regions/bulk/disable
Body: { "ids": [1, 2, 3] }
```

**Bulk toggle regions**
```
POST /api/regions/bulk/toggle
Body: { "ids": [1, 2, 3] }
```

---

## Database Schema

### regions
- `id` - Primary key
- `name` - Region name (e.g., "ACT - Canberra Metro")
- `zone_code` - HDS zone code
- `delivery_hours` - Display hours (e.g., "AM (6am-12pm)")
- `enabled` - Boolean (show/hide at checkout)
- `synced_at` - Last sync timestamp
- `updated_at` - Last update timestamp
- `hds_region_id` - HDS system ID

### delivery_schedules
- `id` - Primary key
- `region_id` - Foreign key to regions
- `cutoff_day` - Order cutoff day (e.g., "Wednesday")
- `pack_day` - Packing day (e.g., "Thursday")
- `delivery_day` - Delivery day (e.g., "Saturday")
- `hours` - Delivery hours (e.g., "AM")
- `enabled` - Boolean (active schedule)
- `is_default` - Boolean (default for region)

### suburbs
- `id` - Primary key
- `name` - Suburb name
- `postcode` - Postal code
- `state` - State code (NSW, VIC, etc.)
- `region_id` - Foreign key to regions
- `serviceable` - Boolean (can HDS deliver?)
- `synced_at` - Last sync timestamp

### hds_sync_logs
- `id` - Primary key
- `sync_type` - "regions" or "suburbs"
- `status` - "success" or "failed"
- `regions_synced` - Count
- `suburbs_synced` - Count
- `error_message` - Error details if failed
- `synced_at` - When sync occurred

---

## HDS API Integration

### Authentication
Uses HDS bearer token (in Authorization header):
```
Authorization: Bearer {token}
```

Token obtained via:
```
POST /api/authenticate
Body: {
  "email": "tomi@workoutmeals.com.au",
  "password": "password"
}
```

### Serviceability Endpoints
1. **Check suburb**: `GET /api/serviceable?suburb={suburb}&postcode={postcode}`
2. **Service schedule**: `GET /api/serviceable/service-days?suburb={suburb}&postcode={postcode}`
3. **Full schedule**: `GET /api/serviceable/full-schedule?suburb={suburb}&postcode={postcode}`

---

## Daily Sync Job

Runs automatically at **2:00 AM every day**:
- Authenticates with HDS API
- Fetches region updates
- Updates local database
- Logs success/failure

---

## Environment Variables

See `.env.example` for required variables:

```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=hds_delivery_admin
DB_USER=postgres
DB_PASSWORD=your_password
HDS_API_URL=https://api.sandbox.homedelivery.com.au
HDS_EMAIL=tomi@workoutmeals.com.au
HDS_PASSWORD=password
PORT=3001
NODE_ENV=development
```

---

## Next Steps

1. ✅ Backend API server (you are here)
2. React frontend components (Screen 1, 2, 3)
3. Shopify integration (delivery selection at checkout)
4. Deployment (Vercel + Railway)
5. Testing & refinement

---

## Architecture

```
hds-delivery-admin-backend/
├── server.js           # Express app entry
├── routes/             # API endpoints
│  └── regions.js      # Region CRUD operations
├── jobs/              # Scheduled tasks
│  └── hds-sync.js     # Daily HDS sync
├── lib/               # Utilities
│  ├── db.js          # Database connection
│  └── hds-client.js  # HDS API client
├── migrations/        # Database setup
│  └── init-db.js     # Create tables
└── package.json
```

---

Developed with ❤️ for Workout Meals
