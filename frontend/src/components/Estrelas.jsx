// Seletor de nota em estrelas, de 0.5 a 5, em passos de 0.5.
// A metade esquerda de cada estrela marca X.5, a direita marca X inteiro.
export default function EstrelaInput({ valor, onChange, tamanho = 28 }) {
  return (
    <div className="estrelas">
      {[1, 2, 3, 4, 5].map((i) => {
        const cheia = valor >= i;
        const meia = valor >= i - 0.5 && valor < i;
        return (
          <span className="estrela-wrap" key={i} style={{ fontSize: tamanho, width: tamanho + 2, height: tamanho + 2 }}>
            <span className="estrela-fundo">★</span>
            <span className="estrela-preenchida" style={{ width: cheia ? '100%' : meia ? '50%' : '0%' }}>★</span>
            <button type="button" className="estrela-hit esquerda" onClick={() => onChange(i - 0.5)} aria-label={`${i - 0.5} estrelas`} />
            <button type="button" className="estrela-hit direita" onClick={() => onChange(i)} aria-label={`${i} estrelas`} />
          </span>
        );
      })}
    </div>
  );
}

// Exibição somente leitura (para mostrar médias já calculadas)
export function EstrelasView({ valor, tamanho = 18 }) {
  return (
    <div className="estrelas">
      {[1, 2, 3, 4, 5].map((i) => {
        const cheia = valor >= i;
        const meia = valor >= i - 0.5 && valor < i;
        return (
          <span className="estrela-wrap" key={i} style={{ fontSize: tamanho, width: tamanho + 2, height: tamanho + 2 }}>
            <span className="estrela-fundo">★</span>
            <span className="estrela-preenchida" style={{ width: cheia ? '100%' : meia ? '50%' : '0%' }}>★</span>
          </span>
        );
      })}
    </div>
  );
}
