"""Cotización formal en PDF, para clientes con RUC (empresas).

Una empresa no paga una mudanza con una tarjeta de cotización en la web: su
área de compras pide un documento con razón social, RUC, IGV, condiciones y
cuenta bancaria. Hasta noviembre de 2026 Carlos lo armaba a mano (Cotizacion_PMS_
Gestion_Integral_251_Chalan.pdf); esto lo hace con los datos de la orden.

- `issuer.py`: los datos de Chalán (RUC, dirección, cuenta, firma).
- `ruc.py`: valida un RUC peruano (dígito verificador).
- `build.py`: orden + cotización + cliente -> dict con cada texto ya escrito.
- `render.py`: ese dict -> PDF con ReportLab (Python puro: el servidor de Perú
  no tiene memoria para un navegador ni para las librerías de WeasyPrint).

Lo que se imprimió queda en `formal_quotations.document`, así que volver a
descargarla da el mismo PDF aunque la orden haya cambiado después.
"""
