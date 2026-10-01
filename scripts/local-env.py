"""Generate local-only secrets once; never overwrite an existing installation."""
import base64
import hashlib
import hmac
import json
import os
from pathlib import Path
import secrets
import time

root = Path(__file__).resolve().parents[1]
path = root / '.env.stack.local'
if path.exists():
    print('Using existing .env.stack.local')
    raise SystemExit(0)

def b64(value):
    return base64.urlsafe_b64encode(value).decode().rstrip('=')

secret = secrets.token_hex(32)
def jwt(role):
    claims = {'role': role, 'iss': 'supabase', 'iat': int(time.time()),
              'exp': int(time.time()) + 10 * 365 * 86400}
    message = b64(b'{"alg":"HS256","typ":"JWT"}') + '.' + b64(json.dumps(claims).encode())
    return message + '.' + b64(hmac.new(secret.encode(), message.encode(), hashlib.sha256).digest())

values = {
    'PUBLIC_URL': 'http://localhost:8080',
    'POSTGRES_PASSWORD': secrets.token_hex(24),
    'JWT_SECRET': secret, 'ANON_KEY': jwt('anon'), 'SERVICE_ROLE_KEY': jwt('service_role'),
    'SECRET_KEY_BASE': secrets.token_hex(48), 'PG_META_CRYPTO_KEY': secrets.token_hex(32),
    'SYNC_PASSWORD': secrets.token_hex(24), 'SYNC_TOKEN': secrets.token_hex(32),
    'DEV_USER_PASSWORD': secrets.token_urlsafe(18),
    'SYNC_INTERVAL_SECONDS': '900', 'PATIENT_RETENTION_DAYS': '3',
}
with os.fdopen(os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), 'w') as f:
    f.writelines(f'{key}={value}\n' for key, value in values.items())
print('Generated .env.stack.local (mode 0600).')
