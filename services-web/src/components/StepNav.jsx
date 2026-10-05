export default function StepNav({ onBack, nextLabel = 'Siguiente', onNext, disabled = false, loading = false }) {
  return (
    <div className="mt-8 flex items-center gap-3">
      {onBack && (
        <button type="button" className="btn-secondary" onClick={onBack} disabled={loading}>
          Atrás
        </button>
      )}
      <button type="button" className="btn-primary flex-1" onClick={onNext} disabled={disabled || loading}>
        {loading ? 'Guardando…' : nextLabel}
      </button>
    </div>
  )
}
