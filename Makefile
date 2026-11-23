# Deploy de chalan.pe (Perú). Detalles en deploy/peru.sh y deploy/peru-local.sh.
# Opciones extra con ARGS, p. ej.: make deploy-peru ARGS='--services "nginx"'

.PHONY: deploy-peru deploy-peru-plan deploy-peru-rollback quotation-link push-test

deploy-peru:
	./deploy/peru-local.sh $(ARGS)

deploy-peru-plan:
	./deploy/peru-local.sh --dry-run $(ARGS)

deploy-peru-rollback:
	./deploy/peru-local.sh --rollback

# Pruebas locales de los avisos push (app/api/carrier_push.py). Opciones con
# ARGS, p. ej.: make quotation-link ARGS='--company 3 --order 2026'
quotation-link:
	@docker exec -e PYTHONWARNINGS=ignore -w /chalan chalan-flask-1 flask quotation-link $(ARGS)

push-test:
	@docker exec -e PYTHONWARNINGS=ignore -w /chalan chalan-flask-1 flask web-push-test $(ARGS)
