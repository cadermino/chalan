import multiprocessing

# bind = '127.0.0.1:5000'
bind ='unix:/run/gunicron.sock'

backlog = 2048
preload_app = True
max_requests = 2048
max_requests_jitter = 128

workers = multiprocessing.cpu_count() * 2 + 1
worker_connections = 1000
timeout = 60
keepalive = 2

errorlog = '-'
loglevel = 'debug'
accesslog = '-'
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s"'


def when_ready(server):
    open('/tmp/app-initialized', 'w').close()