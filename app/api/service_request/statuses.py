"""Los estados de una solicitud: los mismos que una orden (lu_order_status),
guardados como texto en service_requests.status (migración 033).

- pending: desde que el cliente empieza el formulario hasta que el trabajo
  queda en firme. Un borrador es un pending sin submitted_at: todavía no se
  le avisó a nadie y el cliente lo puede editar.
- in_progress: la reserva está pagada (o el cliente eligió sin reserva).
- completed: un admin registró el saldo que el cliente le pagó al transportista.
- cancelled.

Los pasa sync_status (quotations.py) cada vez que cambia la elección o un pago.
"""
PENDING = 'pending'
IN_PROGRESS = 'in_progress'
COMPLETED = 'completed'
CANCELLED = 'cancelled'


def is_draft(service_request):
    return service_request.status == PENDING and service_request.submitted_at is None
