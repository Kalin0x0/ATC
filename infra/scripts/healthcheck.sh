#!/bin/sh
curl -sf http://localhost:3000/health || exit 1
