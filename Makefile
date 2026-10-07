# Deploy de chalan.pe (Perú). Detalles en deploy/peru.sh y deploy/peru-local.sh.
# Opciones extra con ARGS, p. ej.: make deploy-peru ARGS='--services "nginx"'

.PHONY: deploy-peru deploy-peru-plan deploy-peru-rollback

deploy-peru:
	./deploy/peru-local.sh $(ARGS)

deploy-peru-plan:
	./deploy/peru-local.sh --dry-run $(ARGS)

deploy-peru-rollback:
	./deploy/peru-local.sh --rollback
