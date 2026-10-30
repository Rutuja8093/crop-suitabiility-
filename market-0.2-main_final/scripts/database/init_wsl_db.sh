#!/bin/bash
set -e
service postgresql start

su - postgres << 'EOF'
psql -tc "SELECT 1 FROM pg_roles WHERE rolname = 'soilpilot_user'" | grep -q 1 || psql -c "CREATE USER soilpilot_user WITH PASSWORD 'soilpilot_password' SUPERUSER;"
psql -tc "SELECT 1 FROM pg_database WHERE datname = 'soilpilot_db'" | grep -q 1 || psql -c "CREATE DATABASE soilpilot_db OWNER soilpilot_user;"
psql -d soilpilot_db -c "CREATE EXTENSION IF NOT EXISTS postgis;"
psql -d soilpilot_db -c "GRANT ALL PRIVILEGES ON DATABASE soilpilot_db TO soilpilot_user;"
psql -d soilpilot_db -c "GRANT ALL ON SCHEMA public TO soilpilot_user;"
EOF

echo "PostgreSQL and PostGIS successfully configured!"
