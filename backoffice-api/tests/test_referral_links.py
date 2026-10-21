"""Links de referencia de las inmobiliarias: el admin los ve y los copia, y toda
inmobiliaria tiene código aunque no se haya registrado sola."""
from app import db
from app.models import AdminUser
from tests.test_service_requests import admin, make_user  # noqa: F401


def make_agent(email, code=None, **kwargs):
    agent = AdminUser(email=email, role='real_estate_agent', active=1, referral_code=code, **kwargs)
    agent.password = 'testpass123'
    db.session.add(agent)
    db.session.commit()
    return agent


def test_admins_get_every_agent_with_its_code(client, admin):
    make_agent('con@example.com', code='AGT-AAAAA', first_name='Ana', commission_rate=0.07)
    make_agent('sin-ordenes@example.com', code='AGT-BBBBB')

    res = client.get('/api/admin/referred-orders', headers=admin)

    assert res.status_code == 200
    agents = {a['email']: a for a in res.get_json()['agents']}
    assert agents['con@example.com']['referral_code'] == 'AGT-AAAAA'
    assert agents['con@example.com']['name'] == 'Ana'
    assert agents['con@example.com']['commission_rate'] == 0.07
    # Sin órdenes referidas también sale: el link se manda antes de la primera.
    assert agents['sin-ordenes@example.com']['referral_code'] == 'AGT-BBBBB'


def test_an_agent_without_code_gets_one_when_listed(client, admin):
    agent = make_agent('vieja@example.com')

    res = client.get('/api/admin/referred-orders', headers=admin)

    code = res.get_json()['agents'][0]['referral_code']
    assert code and code.startswith('AGT-')
    assert db.session.get(AdminUser, agent.id).referral_code == code


def test_only_admins_see_the_agents(client):
    make_agent('a@example.com', code='AGT-CCCCC')
    assert client.get('/api/admin/referred-orders',
                      headers=make_user('real_estate_agent', suffix='r')).status_code == 403
    assert client.get('/api/admin/referred-orders',
                      headers=make_user('carrier_company', suffix='c')).status_code == 403


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
