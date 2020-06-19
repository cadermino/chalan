Chalán is a marketplace for moving service companies located in Mexico City

## Requisites

- Docker
- Docker-compose >= 1.7.0
- Node 8

## Backend API installation

To install the project for local development

1. Clone the project
```
git clone git@github.com:cadermino/chalan.git
```

2. create an .env file called .env.dev on the root of the project
```
FLASK_ENV=development
SECRET_KEY=random
SECRET_FB_APP_KEY=
MAIL_SERVER=
MAIL_PORT=
MAIL_USERNAME=
MAIL_PASSWORD=
ADMIN_MAIL=
MAIL_SENDER=
MAIL_SUBJECT_PREFIX=
MAIL_USE_TLS=
DEV_DATABASE_URL=
FLASK_APP=
FLASK_DEBUG=1
STRIPE_SECRET_KEY=
STRIPE_SUCCESS=
STRIPE_CANCEL=
CORS=[r"http://localhost:*"]
```
and ask to one of the DevOps guys for the credentials for the .env file

3. create .env.mysql.dev on the root of the project
```
MYSQL_RANDOM_ROOT_PASSWORD=yes
MYSQL_ROOT_PASSWORD=root
MYSQL_DATABASE=chalan
MYSQL_USER=chalan_user
MYSQL_PASSWORD=root
LANG=C.UTF-8
TZ=America/Mexico_City
```

4. And in the project directory run docker compose command
```
docker-compose -f docker-compose.local.yml up
```

## Frontend installation
1. Go to /frontend and create .env.development
```
VUE_APP_BASE_URL=/
VUE_APP_API_URL=http://localhost/api/v1/
VUE_APP_AUTH_API_URL=http://localhost/api/auth/
VUE_APP_FB_ID=
VUE_APP_STRIPE=
```
2. To install the frontend go to /frontend and run:
```
rm -rf dist && npm run build-dev
```
2. Go to http://localhost/landing/
