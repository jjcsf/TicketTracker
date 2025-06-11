-- Initialize the database with required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Note: The application uses Drizzle ORM which will handle
-- table creation through migrations. This file ensures
-- the database is ready with required extensions.