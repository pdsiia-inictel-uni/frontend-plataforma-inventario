import {
  contarSignificativos,
  formatearImporte,
  formatearImporteCompleto,
  importeANumero,
  posicionTrasSignificativos,
} from './importe.model';

describe('Formato de importes en soles', () => {
  it('agrupa los millares con coma', () => {
    expect(formatearImporte('150')).toBe('150');
    expect(formatearImporte('18789')).toBe('18,789');
    expect(formatearImporte('1234567')).toBe('1,234,567');
  });

  it('el punto abre los centimos', () => {
    expect(formatearImporte('150.5')).toBe('150.5');
    expect(formatearImporte('18789.00')).toBe('18,789.00');
  });

  it('respeta el punto a medio escribir', () => {
    // Si completara los centimos aqui, el usuario no podria seguir tecleando.
    expect(formatearImporte('150.')).toBe('150.');
  });

  it('no admite mas de dos centimos', () => {
    expect(formatearImporte('12.3456')).toBe('12.34');
  });

  it('solo acepta el primer punto', () => {
    expect(formatearImporte('1.2.3')).toBe('1.23');
  });

  it('descarta lo que no sea numero, incluidas las comas que teclee el usuario', () => {
    // La coma la pone el formato; tecleada, se ignora y se recoloca sola.
    expect(formatearImporte('18,789')).toBe('18,789');
    expect(formatearImporte('S/ 1a5b0')).toBe('150');
  });

  it('entiende el punto inicial como cero coma', () => {
    expect(formatearImporte('.5')).toBe('0.5');
  });

  it('quita los ceros de delante', () => {
    expect(formatearImporte('0150')).toBe('150');
    expect(formatearImporte('0')).toBe('0');
  });

  it('el campo vacio no inventa un cero', () => {
    expect(formatearImporte('')).toBe('');
    expect(importeANumero('')).toBeNull();
  });

  it('completa los centimos al cerrar el importe', () => {
    expect(formatearImporteCompleto(150)).toBe('150.00');
    expect(formatearImporteCompleto(18789)).toBe('18,789.00');
    expect(formatearImporteCompleto(18789.5)).toBe('18,789.50');
    expect(formatearImporteCompleto(0)).toBe('0.00');
  });

  it('devuelve el numero que el servidor espera', () => {
    expect(importeANumero('18,789.50')).toBe(18789.5);
    expect(importeANumero('150')).toBe(150);
    // Un punto suelto al final aun no significa centimos.
    expect(importeANumero('150.')).toBe(150);
  });

  it('ida y vuelta: lo formateado se vuelve a leer igual', () => {
    for (const valor of [0, 7.05, 150, 999.99, 18789.5, 1234567.89]) {
      expect(importeANumero(formatearImporteCompleto(valor))).toBe(valor);
    }
  });
});

describe('Cursor al reformatear el importe', () => {
  it('cuenta los caracteres con significado del tramo', () => {
    expect(contarSignificativos('18,7')).toBe(3);
    expect(contarSignificativos('1,234.5')).toBe(6);
    expect(contarSignificativos('')).toBe(0);
  });

  it('coloca el cursor tras el mismo numero de cifras', () => {
    // "1878" con el cursor al final -> "1,878": la cifra sigue siendo la 4a.
    expect(posicionTrasSignificativos('1,878', 4)).toBe(5);
    // Editando en medio: tras la segunda cifra de "18,789" va la coma.
    expect(posicionTrasSignificativos('18,789', 2)).toBe(2);
    expect(posicionTrasSignificativos('18,789', 3)).toBe(4);
  });

  it('sin cifras a la izquierda el cursor se queda al principio', () => {
    expect(posicionTrasSignificativos('18,789', 0)).toBe(0);
  });

  it('nunca se sale del texto', () => {
    expect(posicionTrasSignificativos('150', 99)).toBe(3);
  });
});
