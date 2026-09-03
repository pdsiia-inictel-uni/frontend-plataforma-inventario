/**
 * Prueba de regresion de la Content-Security-Policy estricta (RNF-07).
 *
 * <p>La ERS exige una prueba automatica que falle si reaparece un estilo o un
 * manejador en linea. Esta la implementa recorriendo el codigo fuente real,
 * no el DOM de un componente: un atributo en linea escrito hoy en una
 * plantilla que ninguna prueba renderiza romperia la aplicacion en produccion
 * y nadie se enteraria hasta desplegarla.</p>
 *
 * <p>Las plantillas se cargan con {@code import.meta.glob} en modo crudo, que
 * Vite resuelve en tiempo de compilacion, de modo que la prueba no necesita
 * acceso al sistema de archivos.</p>
 */

// El empaquetador sustituye estas llamadas por objetos literales al compilar,
// asi que deben escribirse con el nombre completo y las opciones en linea.

/** Plantillas HTML de los componentes. */
const plantillas = import.meta.glob('/src/**/*.html', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** Codigo TypeScript, donde viven las plantillas en linea y los estilos. */
const fuentes = import.meta.glob('/src/**/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** La pagina de arranque, que sirve la etiqueta meta de la politica. */
const indice = import.meta.glob('/src/index.html', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/**
 * Manejadores de evento en atributos HTML: onclick, onchange, onerror...
 *
 * <p>No confundir con la sintaxis de Angular {@code (click)="..."}, que
 * registra el manejador por codigo y no genera ningun atributo.</p>
 */
const MANEJADOR_EN_LINEA = /\son[a-z]+\s*=\s*["']/i;

/** Atributo style literal. La forma [style.x] de Angular no genera atributo. */
const ESTILO_EN_LINEA = /\sstyle\s*=\s*["']/i;

/** Recursos servidos desde otro origen. */
const ORIGEN_EXTERNO = /(?:src|href)\s*=\s*["'](?:https?:)?\/\//i;

function sinPruebas(rutas: string[]): string[] {
  return rutas.filter((ruta) => !ruta.endsWith('.spec.ts'));
}

describe('Content-Security-Policy estricta (RNF-07)', () => {
  it('encuentra las plantillas del proyecto', () => {
    // Si el glob dejara de resolver, el resto de la prueba pasaria en vacio.
    expect(Object.keys(plantillas).length).toBeGreaterThan(5);
    expect(Object.keys(fuentes).length).toBeGreaterThan(20);
  });

  it('ninguna plantilla usa manejadores de evento en atributos HTML', () => {
    const culpables = Object.entries(plantillas)
      .filter(([, contenido]) => MANEJADOR_EN_LINEA.test(contenido))
      .map(([ruta]) => ruta);

    expect(culpables, `script-src-attr 'none' bloquearia: ${culpables.join(', ')}`).toEqual([]);
  });

  it('ninguna plantilla usa el atributo style en linea', () => {
    const culpables = Object.entries(plantillas)
      .filter(([, contenido]) => ESTILO_EN_LINEA.test(contenido))
      .map(([ruta]) => ruta);

    expect(culpables, `style-src-attr 'none' bloquearia: ${culpables.join(', ')}`).toEqual([]);
  });

  it('ninguna plantilla en linea de un componente usa atributos prohibidos', () => {
    const culpables = sinPruebas(Object.keys(fuentes))
      .filter((ruta) => {
        const contenido = fuentes[ruta];
        if (!contenido.includes('template:')) {
          return false;
        }
        return MANEJADOR_EN_LINEA.test(contenido) || ESTILO_EN_LINEA.test(contenido);
      });

    expect(culpables, `plantillas en linea con atributos prohibidos: ${culpables.join(', ')}`).toEqual([]);
  });

  it('ningun componente declara estilos propios', () => {
    // Angular inyecta los estilos de componente como etiquetas <style> en
    // tiempo de ejecucion, y style-src 'self' las bloquea. Toda la hoja de
    // estilos se sirve como archivo desde el propio origen.
    const culpables = sinPruebas(Object.keys(fuentes)).filter((ruta) =>
      /\b(styles|styleUrl|styleUrls)\s*:/.test(fuentes[ruta]),
    );

    expect(culpables, `estilos de componente que la CSP bloquearia: ${culpables.join(', ')}`).toEqual([]);
  });

  it('ninguna plantilla enlaza recursos de otro origen', () => {
    // connect-src, script-src, style-src y font-src son todos 'self': un CDN
    // quedaria bloqueado. Toda la interfaz se sirve desde el propio origen.
    const culpables = Object.entries(plantillas)
      .filter(([, contenido]) => ORIGEN_EXTERNO.test(contenido))
      .map(([ruta]) => ruta);

    expect(culpables, `recursos externos que la CSP bloquearia: ${culpables.join(', ')}`).toEqual([]);
  });

  it('ninguna plantilla incrusta etiquetas script', () => {
    const culpables = Object.entries(plantillas)
      .filter(([, contenido]) => /<script[\s>]/i.test(contenido))
      .map(([ruta]) => ruta);

    expect(culpables, `scripts embebidos: ${culpables.join(', ')}`).toEqual([]);
  });

  it('la politica declarada en index.html no relaja la seguridad', () => {
    const html = indice['/src/index.html'];
    expect(html).toBeTruthy();

    // La politica lleva comillas simples dentro ('self', 'none'), asi que se
    // delimita solo por las dobles del atributo.
    const politica = /content="([^"]*default-src[^"]*)"/i.exec(html)?.[1] ?? '';
    expect(politica, 'index.html debe declarar la politica para el servidor de desarrollo').toContain(
      "default-src 'self'",
    );

    expect(politica).not.toContain('unsafe-inline');
    expect(politica).not.toContain('unsafe-eval');

    for (const directiva of [
      "script-src 'self'",
      "script-src-attr 'none'",
      "style-src 'self'",
      "style-src-attr 'none'",
      "img-src 'self' data: blob:",
      // RF-78: el marco de la vista previa del formato de uso, y nada mas.
      "frame-src 'self' blob:",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ]) {
      expect(politica, `falta la directiva ${directiva}`).toContain(directiva);
    }
  });

  it('la etiqueta meta no declara directivas que el navegador ignora ahi', () => {
    // frame-ancestors y upgrade-insecure-requests solo surten efecto en la
    // cabecera HTTP. Declararlas en el <meta> no protege de nada y llena la
    // consola de avisos; su sitio es la cabecera que emite el backend.
    const politica = /content="([^"]*default-src[^"]*)"/i.exec(indice['/src/index.html'])?.[1] ?? '';

    expect(politica).not.toContain('frame-ancestors');
    expect(politica).not.toContain('upgrade-insecure-requests');
  });

  it('index.html no incrusta scripts ni estilos propios', () => {
    const html = indice['/src/index.html'];
    // El unico script admitido es el que inyecta el compilador al construir.
    expect(/<script(?![^>]*\ssrc=)[^>]*>/i.test(html)).toBe(false);
    expect(/<style[\s>]/i.test(html)).toBe(false);
    expect(MANEJADOR_EN_LINEA.test(html)).toBe(false);
    expect(ESTILO_EN_LINEA.test(html)).toBe(false);
  });
});
