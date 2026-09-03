/**
 * Formato de los importes en soles.
 *
 * <p>El costo de un bien se escribe como se lee en una factura: los millares
 * separados por coma y los centimos por punto (18,789.00). El usuario solo
 * teclea digitos y el punto que abre los centimos; las comas las pone el
 * formato mientras escribe, porque un numero de cinco cifras sin agrupar se
 * cuenta con el dedo en la pantalla y se equivoca (RNF-22, RNF-25).</p>
 *
 * <p>Funciones puras, sin Angular ni DOM: las reglas se comprueban sin montar
 * un componente (RNF-38).</p>
 */

/** Centimos que admite un importe en soles. */
const DECIMALES = 2;

/**
 * Deja solo lo que es numero: digitos y, como mucho, un punto decimal.
 *
 * <p>La coma se descarta siempre: es separador de millares y lo pone el
 * formato, no quien escribe. Un punto inicial se entiende como "0." para que
 * escribir ".50" no pierda el punto.</p>
 */
function soloNumero(bruto: string): string {
  let salida = '';
  let hayPunto = false;
  for (const caracter of bruto) {
    if (caracter >= '0' && caracter <= '9') {
      salida += caracter;
    } else if (caracter === '.' && !hayPunto) {
      salida += salida === '' ? '0.' : '.';
      hayPunto = true;
    }
  }
  return salida;
}

/** Agrupa los millares de la parte entera: 18789 -> 18,789. */
function agruparMillares(entero: string): string {
  const sinCerosDelante = entero.replace(/^0+(?=\d)/, '');
  return sinCerosDelante.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Da formato a lo que el usuario lleva escrito, sin completar los centimos:
 * mientras teclea, "150." debe seguir siendo "150." y no saltar a "150.00".
 */
export function formatearImporte(bruto: string): string {
  const limpio = soloNumero(bruto);
  if (limpio === '') {
    return '';
  }
  const punto = limpio.indexOf('.');
  if (punto < 0) {
    return agruparMillares(limpio);
  }
  const entero = agruparMillares(limpio.slice(0, punto));
  const centimos = limpio.slice(punto + 1, punto + 1 + DECIMALES);
  return `${entero}.${centimos}`;
}

/** Formato definitivo, con los centimos completos: 18789.5 -> 18,789.50. */
export function formatearImporteCompleto(valor: number): string {
  return formatearImporte(valor.toFixed(DECIMALES));
}

/** Valor numerico de lo escrito, o null si aun no hay ninguna cifra. */
export function importeANumero(texto: string): number | null {
  const limpio = soloNumero(texto);
  if (limpio === '') {
    return null;
  }
  const valor = Number(limpio.endsWith('.') ? limpio.slice(0, -1) : limpio);
  return Number.isFinite(valor) ? valor : null;
}

/**
 * Cuenta los caracteres con significado (digitos y punto) de un tramo.
 *
 * <p>Sirve para no perder el cursor al reformatear: al insertar una coma el
 * texto se alarga, y si el cursor se fuera al final no se podria corregir una
 * cifra del medio.</p>
 */
export function contarSignificativos(tramo: string): number {
  let cuenta = 0;
  for (const caracter of tramo) {
    if ((caracter >= '0' && caracter <= '9') || caracter === '.') {
      cuenta++;
    }
  }
  return cuenta;
}

/** Posicion del texto ya formateado que sigue a N caracteres con significado. */
export function posicionTrasSignificativos(texto: string, cuantos: number): number {
  if (cuantos <= 0) {
    return 0;
  }
  let vistos = 0;
  for (let i = 0; i < texto.length; i++) {
    const caracter = texto[i];
    if ((caracter >= '0' && caracter <= '9') || caracter === '.') {
      vistos++;
      if (vistos === cuantos) {
        return i + 1;
      }
    }
  }
  return texto.length;
}
