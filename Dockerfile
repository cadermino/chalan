FROM python:3.6-alpine

RUN adduser -D chalan_user
USER chalan_user

WORKDIR /home/chalan_user

COPY requirements requirements
RUN python -m venv venv
RUN venv/bin/pip install -r requirements/dev.txt

COPY app app
COPY chalan.py config.py boot.sh ./

# run-time configuration
EXPOSE 5000
# ENTRYPOINT ["./boot.sh"]