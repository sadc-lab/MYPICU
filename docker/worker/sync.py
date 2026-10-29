"""docker compose exec sync-worker python -m sync [#encounterid]"""
import os
import sys
import httpx

path = '/sync' + ('/' + str(int(sys.argv[1].removeprefix('#'))) if len(sys.argv) > 1 else '')
response = httpx.post('http://localhost:8001' + path,
    headers={'Authorization': 'Bearer ' + os.environ['SYNC_TOKEN']}, timeout=7200)
response.raise_for_status()
print(response.json())
if response.json()['status'] != 'completed':
    raise SystemExit(1)
