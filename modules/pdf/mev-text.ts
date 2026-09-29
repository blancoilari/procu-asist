/** Solo después de clasificar la respuesta como página legítima del proveído. */
export function textoMevValidado(text: string, inexistente: boolean): string | null {
  if (text.trim()) return text.trim();
  return inexistente ? 'Texto del Proveído inexistente en la MEV.' : null;
}
