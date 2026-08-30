# Architecture

## Confirmed

The project is an npm-workspaces TypeScript monorepo: React/Vite in `apps/client`, Express in `apps/server`, and Prisma/PostgreSQL schema in `prisma`. The current server has only `GET /health`; the client is a minimal mount point.

The database boundary is now designed as:

```text
Frontend
  ↓
Backend/API
  ↓
Service and business-rule layer (planned)
  ↓
Prisma
  ↓
PostgreSQL
```

Prisma owns persistence mapping and database constraints. PostgreSQL holds the relational core, including foreign keys and uniqueness. An initial migration is not yet present or applied because a real development PostgreSQL connection has not been configured.

## Planned

Authentication will establish server-side identity. API/service code will use that identity for role, ownership, and enrollment checks; frontend-submitted roles or IDs will never authorize an action. The service layer will derive and update enrollment progress from lesson progress, perform reorder transactions, and enforce activity immutability.

Catalogue filtering, searching, sorting, pagination, and total counts will remain server/database queries. No business APIs, UI flows, authentication, authorization, activity behavior, comments, alerts, CSV processing, or analytics has been implemented.
