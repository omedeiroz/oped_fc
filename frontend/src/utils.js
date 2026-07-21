// Iniciais do nome (até 2 letras)
export function iniciais(nome) {
  const partes = String(nome || '').trim().split(/\s+/);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

// Cor estável (HSL) derivada de um texto — para avatares
export function corDoNome(nome) {
  let h = 0;
  const s = String(nome || '');
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return `hsl(${h} 55% 42%)`;
}

export function formatarData(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC',
  });
}

export function formatarDataLonga(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('pt-BR', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC',
  });
}

// Lê um arquivo de imagem, recorta em quadrado (centro) e redimensiona,
// devolvendo um data URL JPEG comprimido — pronto para enviar ao backend.
export function redimensionarImagem(file, tamanho = 320, qualidade = 0.85) {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
    leitor.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Arquivo não é uma imagem válida.'));
      img.onload = () => {
        const lado = Math.min(img.width, img.height);
        const sx = (img.width - lado) / 2;
        const sy = (img.height - lado) / 2;
        const canvas = document.createElement('canvas');
        canvas.width = tamanho;
        canvas.height = tamanho;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, sx, sy, lado, lado, 0, 0, tamanho, tamanho);
        resolve(canvas.toDataURL('image/jpeg', qualidade));
      };
      img.src = leitor.result;
    };
    leitor.readAsDataURL(file);
  });
}
