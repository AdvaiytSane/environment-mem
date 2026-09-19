export function joinUrl(...parts) {
  return parts
    .map((part, index) => {
      let piece = part;
      if (index !== 0) piece = piece.replace(/^\/+/, '');
      if (index !== parts.length - 1) piece = piece.replace(/\/+$/, '');
      return piece;
    })
    .filter((piece) => piece.length > 0)
    .join('/');
}
