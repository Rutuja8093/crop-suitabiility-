#!/bin/bash
set -e
mkdir -p /etc/postgresql/18/main/conf.d
echo "listen_addresses = '*'" > /etc/postgresql/18/main/conf.d/listen.conf
echo "host all all 0.0.0.0/0 scram-sha-256" >> /etc/postgresql/18/main/pg_hba.conf
echo "host all all 0.0.0.0/0 trust" >> /etc/postgresql/18/main/pg_hba.conf
echo "host all all ::0/0 trust" >> /etc/postgresql/18/main/pg_hba.conf
service postgresql restart
echo "PostgreSQL network access enabled!"
