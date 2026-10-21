"""Links de referencia de las inmobiliarias: se copian desde Usuarios, y toda
inmobiliaria tiene código aunque no se haya registrado sola."""
from app import db
from app.models import AdminUser
from tests.test_service_requests import make_user


def make_agent(email, code=None, **kwargs):
    agent = AdminUser(email=email, role='real_estate_agent', active=1, referral_code=code, **kwargs)
    agent.password = 'testpass123'
    db.session.add(agent)
    db.session.commit()
    return agent


def test_the_users_list_carries_each_agent_code(client):
    make_agent('con@example.com', code='AGT-AAAAA')

    res = client.get('/api/users', headers=make_user('superadmin', suffix='s'))

    agent = next(u for u in res.get_json()['users'] if u['email'] == 'con@example.com')
    assert agent['referral_code'] == 'AGT-AAAAA'


def test_an_agent_without_code_gets_one_when_listed(client):
    agent = make_agent('vieja@example.com')

    res = client.get('/api/users', headers=make_user('superadmin', suffix='s'))

    listed = next(u for u in res.get_json()['users'] if u['email'] == 'vieja@example.com')
    assert listed['referral_code'].startswith('AGT-')
    assert db.session.get(AdminUser, agent.id).referral_code == listed['referral_code']


def test_other_users_get_no_code(client):
    make_user('admin', suffix='x')
    res = client.get('/api/users', headers=make_user('superadmin', suffix='s'))
    assert all(u['referral_code'] is None for u in res.get_json()['users'])


def test_a_superadmin_creating_an_agent_gives_it_a_code(client):
    superadmin = make_user('superadmin', suffix='s')

    res = client.post('/api/users', headers=superadmin, json={
        'email': 'nueva@example.com', 'password': 'testpass123', 'role': 'real_estate_agent'})

    assert res.status_code == 201
    assert res.get_json()['user']['referral_code'].startswith('AGT-')


def test_changing_a_user_to_agent_gives_it_a_code(client):
    superadmin = make_user('superadmin', suffix='s')
    user = AdminUser(email='admin2@example.com', role='admin', active=1)
    user.password = 'testpass123'
    db.session.add(user)
    db.session.commit()

    res = client.put(f'/api/users/{user.id}', headers=superadmin, json={'role': 'real_estate_agent'})

    assert res.get_json()['user']['referral_code'].startswith('AGT-')


def test_an_agent_keeps_its_code_when_edited(client):
    superadmin = make_user('superadmin', suffix='s')
    agent = make_agent('fija@example.com', code='AGT-DDDDD')

    res = client.put(f'/api/users/{agent.id}', headers=superadmin, json={'commission_rate': 0.1})

    assert res.get_json()['user']['referral_code'] == 'AGT-DDDDD'
