"""Transactional, checksum-verified migrations and idempotent local user seed."""
import hashlib
import os
from pathlib import Path
import httpx
import psycopg
from psycopg import sql

with psycopg.connect(os.environ['LOCAL_DSN'], autocommit=True) as db:
    db.execute('SELECT pg_advisory_lock(726401)')
    db.execute('CREATE SCHEMA IF NOT EXISTS local_migrations')
    db.execute('REVOKE ALL ON SCHEMA local_migrations FROM PUBLIC, anon, authenticated')
    db.execute('CREATE TABLE IF NOT EXISTS local_migrations.applied (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz DEFAULT now())')
    files = [Path('/db/00_baseline.sql'), *sorted(Path('/migrations').glob('*.sql')), *sorted(Path('/db').glob('9*.sql'))]
    for path in files:
        body = path.read_text()
        checksum = hashlib.sha256(body.encode()).hexdigest()
        row = db.execute('SELECT checksum FROM local_migrations.applied WHERE name=%s', (path.name,)).fetchone()
        if row:
            if row[0] != checksum:
                raise RuntimeError(f'Applied migration changed: {path.name}')
            continue
        with db.transaction():
            db.execute(body)
            db.execute('INSERT INTO local_migrations.applied (name, checksum) VALUES (%s,%s)', (path.name, checksum))
        print('Applied', path.name, flush=True)
    db.execute(sql.SQL('ALTER ROLE optibrain_sync PASSWORD {}').format(sql.Literal(os.environ['SYNC_PASSWORD'])))
    headers = {'Authorization': 'Bearer ' + os.environ['SERVICE_ROLE_KEY']}
    with httpx.Client(base_url='http://auth:9999', headers=headers, timeout=30) as client:
        for role, wards in [('manager', ['pedA', 'pedB']), ('worker', ['pedA'])]:
            email = f'{role}@local.test'
            existing = db.execute('SELECT id FROM auth.users WHERE email=%s', (email,)).fetchone()
            if existing:
                uid = existing[0]
            else:
                response = client.post('/admin/users', json={'email': email, 'password': os.environ['DEV_USER_PASSWORD'],
                    'email_confirm': True, 'user_metadata': {'full_name': 'Local ' + role, 'role': role}})
                response.raise_for_status()
                uid = response.json()['id']
            for ward in wards:
                db.execute('INSERT INTO public.user_wards(user_id,ward) VALUES (%s,%s) ON CONFLICT DO NOTHING', (uid, ward))
    db.execute("NOTIFY pgrst, 'reload schema'")
print('Database and local users ready.')
