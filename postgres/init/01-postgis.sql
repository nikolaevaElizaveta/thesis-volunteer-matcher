-- Runs once on first container init (empty data dir). For existing DBs, run manually:
--   psql -U ... -d volunteer_matcher -c "CREATE EXTENSION IF NOT EXISTS postgis;"
CREATE EXTENSION IF NOT EXISTS postgis;
