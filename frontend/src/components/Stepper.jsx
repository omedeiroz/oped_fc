// Contador +/- reutilizável — evita o problema de inputs numéricos
// controlados que "travam" em NaN quando o campo é limpo pra digitar.
export default function Stepper({ value, onChange, min = 0, max = 99, step = 1, label }) {
  function alterar(delta) {
    const novo = Math.min(max, Math.max(min, value + delta));
    if (novo !== value) onChange(novo);
  }
  return (
    <div className="stepper">
      {label && <span className="stepper-label">{label}</span>}
      <button type="button" className="stepper-btn" onClick={() => alterar(-step)} disabled={value <= min} aria-label="Diminuir">−</button>
      <span className="stepper-val">{value}</span>
      <button type="button" className="stepper-btn" onClick={() => alterar(step)} disabled={value >= max} aria-label="Aumentar">+</button>
    </div>
  );
}
