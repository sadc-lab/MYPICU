"""Local integration smoke test. Temporary fixtures are removed in finally."""
import asyncio
from datetime import datetime, timedelta, timezone
import html
import json
import os
import re
import time
from urllib.parse import urlsplit, parse_qs
from uuid import uuid4

import httpx
import psycopg
from psycopg.rows import dict_row
from websockets.asyncio.client import connect
from cache import replace_cache
from worker import apply_census

BASE = 'http://envoy:8000'
ANON = os.environ['ANON_KEY']
SERVICE = os.environ['SERVICE_ROLE_KEY']
PASSWORD = os.environ['DEV_USER_PASSWORD']
IDS = ['#-900000001', '#-900000002']
signup_email = 'stack-test-' + uuid4().hex + '@local.test'
db = psycopg.connect(os.environ['LOCAL_DSN'], autocommit=True, row_factory=dict_row)
admin_db = db
http = httpx.Client(base_url=BASE, headers={'apikey': ANON}, timeout=30)

def login(role, password=PASSWORD):
    email = role if '@' in role else role + '@local.test'
    r = http.post('/auth/v1/token?grant_type=password', json={'email': email, 'password': password})
    assert r.status_code == 200, f'Login failed ({r.status_code})'
    return {'Authorization': 'Bearer ' + r.json()['access_token']}

def mail_link(after_id=None):
    for _ in range(30):
        messages = httpx.get('http://mailpit:8025/api/v1/messages').json()['messages']
        for msg in messages:
            if msg['ID'] == after_id or not any(x['Address'] == signup_email for x in msg['To']):
                continue
            body = httpx.get('http://mailpit:8025/api/v1/message/' + msg['ID']).json()
            link = re.search(r'http://localhost:8080/auth/v1/verify\?[^\s<>"\]]+', html.unescape(body['HTML'] or body['Text']))
            if link:
                return link[0].replace('http://localhost:8080', BASE), msg['ID']
        time.sleep(0.3)
    raise AssertionError('Email did not arrive')

async def realtime_check(headers):
    token = headers['Authorization'].removeprefix('Bearer ')
    async with connect(f'ws://envoy:8000/realtime/v1/websocket?apikey={ANON}&vsn=1.0.0') as ws:
        await ws.send(json.dumps({'topic':'realtime:stack-test', 'event':'phx_join', 'ref':'1', 'payload': {
            'config': {'broadcast': {'self':False}, 'presence': {'key':''}, 'postgres_changes': [
                {'event':'UPDATE','schema':'public','table':'patients','filter':f'id=eq.{IDS[0]}'}]},
            'access_token': token}}))
        while True:
            msg = json.loads(await asyncio.wait_for(ws.recv(), 30))
            if msg['event'] == 'system':
                assert msg['payload']['status'] == 'ok', msg['payload']
                break
        db.execute('UPDATE public.patients SET name=%s WHERE id=%s', ('Realtime smoke', IDS[0]))
        while True:
            msg = json.loads(await asyncio.wait_for(ws.recv(), 30))
            if msg['event'] == 'postgres_changes':
                assert msg['payload']['data']['record']['id'] == IDS[0]
                break

try:
    assert http.get('/health').status_code == 200
    assert http.get('/optibrain').status_code == 200
    assert httpx.get(BASE+'/rest/v1/patients').status_code == 401
    assert http.get('/rest/v1/patients').json() == []
    for pid, ward in zip(IDS, ['pedA','pedB']):
        db.execute("INSERT INTO public.patients(id,name,ward) VALUES(%s,'Temporary stack verification',%s)", (pid, ward))
    manager, worker = login('manager'), login('worker')
    query = {'select':'id', 'id':'in.(' + ','.join(IDS) + ')'}
    assert len(http.get('/rest/v1/patients', params=query, headers=manager).json()) == 2
    assert http.get('/rest/v1/patients', params=query, headers=worker).json() == [{'id':IDS[0]}]
    forbidden = http.post('/rest/v1/user_wards', headers=worker, json={'user_id':str(uuid4()),'ward':'pedB'})
    assert forbidden.status_code == 403
    print('PASS: login, API-key gateway and ward RLS')

    manager_id = db.execute("SELECT id FROM auth.users WHERE email='manager@local.test'").fetchone()['id']
    db.execute('INSERT INTO public.patient_view_log(user_id,patient_id) VALUES(%s,%s)', (manager_id,IDS[0]))
    db.execute("INSERT INTO public.patient_objectives(patient_id,organ,type,content) VALUES(%s,'brain','objective','Test')", (IDS[0],))
    db.execute("INSERT INTO public.patient_custom_view(patient_id,module,indicator_label,action) VALUES(%s,'optibrain','PIC','pin')", (IDS[0],))
    db = psycopg.connect(os.environ['LOCAL_DSN'], user='sync_worker', password=os.environ['SYNC_PASSWORD'],
        autocommit=True, row_factory=dict_row)
    harvest = {'vitals': [(IDS[0], 'Variable_PIC', '2026-01-01T12:00:00', 12)],
               'medications': [], 'pupils': [], 'notes': []}
    with db.transaction():
        replace_cache(db, [IDS[0]], harvest)
    with db.transaction():
        replace_cache(db, [IDS[0]], harvest)
    assert db.execute('SELECT count(*) AS n FROM public.patient_vitals WHERE patient_id=%s',(IDS[0],)).fetchone()['n'] == 1
    try:
        with db.transaction():
            replace_cache(db, [IDS[0]], dict(harvest,
                vitals=[(IDS[0], 'Variable_PIC', None, 99)]))
    except psycopg.errors.NotNullViolation:
        pass
    else:
        raise AssertionError('Expected failed COPY')
    assert db.execute('SELECT valeur FROM public.patient_vitals WHERE patient_id=%s',(IDS[0],)).fetchone()['valeur'] == 12
    start = time.monotonic()
    cached = http.get('/rest/v1/patient_vitals', params={'patient_id':'eq.'+IDS[0]},headers=worker)
    assert cached.status_code == 200 and len(cached.json()) == 1
    print(f'PASS: atomic cache replacement, rollback, idempotence; cached fixture read {(time.monotonic()-start)*1000:.1f} ms')

    # This transaction always rolls back, including any effects on live census.
    with db.transaction(force_rollback=True):
        now = datetime.now(timezone.utc)
        row = {'encounterid':-900000001,'name':'Census test','age':'2y 0m 0d', 'weight':None,
            'bedlabel':'T0', 'clinicalunitid':7,'intime':now-timedelta(days=8),'outtime':None}
        apply_census(db, [row])
        assert db.execute('SELECT diagnosis FROM public.patients WHERE id=%s',(IDS[0],)).fetchone()['diagnosis'] == ''
        version = lambda: db.execute('SELECT ctid::text AS v FROM public.patients WHERE id=%s',(IDS[0],)).fetchone()['v']
        before = version()
        apply_census(db, [dict(row)])
        assert version() == before, 'Unchanged census rewrote the patient row (spurious Realtime event)'
        apply_census(db, [dict(row, bedlabel='T1')])
        assert version() != before, 'Real census change was not written'
        row['outtime'] = now-timedelta(days=2)
        assert apply_census(db,[row]) == []
        assert db.execute('SELECT id FROM public.patients WHERE id=%s',(IDS[0],)).fetchone()
        row['outtime'] = now-timedelta(days=4)
        apply_census(db,[row])
        assert not db.execute('SELECT id FROM public.patients WHERE id=%s',(IDS[0],)).fetchone()
        assert not db.execute('SELECT id FROM public.patient_vitals WHERE patient_id=%s',(IDS[0],)).fetchone()
    print('PASS: discharge stops sync; three-day retention and cascading purge')

    db.close()
    db = admin_db
    asyncio.run(realtime_check(manager))
    print('PASS: authenticated Realtime subscription receives database update through Envoy')

    r = http.post('/auth/v1/signup', json={'email':signup_email,'password':PASSWORD})
    assert r.status_code == 200, f'Signup status {r.status_code}'
    link, msg_id = mail_link()
    verify = http.get(link, follow_redirects=False)
    assert verify.status_code in (302,303) and 'access_token=' in verify.headers['location']
    login(signup_email)
    r = http.post('/auth/v1/recover?redirect_to=http://localhost:8080/auth/reset-password', json={'email':signup_email})
    assert r.status_code == 200
    link, _ = mail_link(msg_id)
    verify = http.get(link, follow_redirects=False)
    parts = parse_qs(urlsplit(verify.headers['location']).fragment)
    assert parts['type'] == ['recovery']
    new_password = PASSWORD + '!new'
    r = http.put('/auth/v1/user', headers={'Authorization':'Bearer '+parts['access_token'][0]},json={'password':new_password})
    assert r.status_code == 200
    login(signup_email, new_password)
    print('PASS: signup confirmation and password recovery via Mailpit and Envoy')
finally:
    if db is not admin_db:
        db.close()
        db = admin_db
    db.execute('DELETE FROM public.patients WHERE id = ANY(%s)',(IDS,))
    db.execute('DELETE FROM auth.users WHERE email=%s',(signup_email,))
    db.close()
    http.close()
