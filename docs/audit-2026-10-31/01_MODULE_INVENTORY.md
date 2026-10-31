# Module Inventory

## Frontend (src)
- Dashboard: src/modules/dashboard
- Items: src/modules/items (ItemMasterListView, ItemCreationView, CustomSpecificationsView, BranchAvailabilityView)
- Business Partners: src/modules/businessPartners
- Approvals: src/modules/approvals
- Communication: src/modules/communication (12 views)
- Requests: src/modules/requests
- Settings: src/modules/settings (8 views)
- Integration: src/modules/integration (SapIntegrationView)
- Public: src/modules/public (Landing, Login, NotFound, Legal)

## Backend (server/src)
- Health routes: server/src/routes/health.ts
- Items routes: server/src/routes/items.ts
- GST routes: server/src/routes/gst.ts
- Repositories: server/src/repositories/gst.ts
- Services: server/src/services/gstProvider.ts
- Migrations: server/src/migrations/001-005

## Tests
- Frontend: src/test/* (6 files)
- Backend: server/test/* (3 files)

## Data
- src/data/seedData.ts, seedWorkflows.ts, communicationSeed.ts, communicationExtendedSeed.ts, dashboardCatalogue.ts, geoData.ts
