#!/bin/bash
export DATABASE_URL="file:/home/z/my-project/db/custom.db"
export NODE_OPTIONS="--max-old-space-size=8192"
cd /home/z/my-project
exec npx next dev -p 3000
