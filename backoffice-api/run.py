import os

from app import create_app

# 'production' lo pone Dockerfile.backoffice-api.prod; local y tests siguen igual.
app = create_app(os.environ.get('BACKOFFICE_CONFIG', 'default'))

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8002, debug=True)
