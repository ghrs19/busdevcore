#!/bin/bash
cd /workspace
if [ ! -d ".next" ]; then
  npm run build
fi
exec npm run start
