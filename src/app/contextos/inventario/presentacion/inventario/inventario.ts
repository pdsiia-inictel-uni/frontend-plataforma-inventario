import { Component, HostListener, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { NotificacionStore } from '../../../../compartido/aplicacion/notificacion.store';
import { RefrescoAutomatico } from '../../../../compartido/aplicacion/refresco-automatico';
import { PAGINA_VACIA, Pagina } from '../../../../compartido/dominio/pagina.model';
import { mensajeError } from '../../../../compartido/infraestructura/http/error.interceptor';
import { SesionStore } from '../../../iam/aplicacion/sesion.store';
import { OrganizacionFacade } from '../../../organizacion/aplicacion/organizacion.facade';
import { Coordinacion } from '../../../organizacion/dominio/estructura.model';
import { FiltroActivo } from '../../../../compartido/presentacion/barra-filtros/barra-filtros';
import { ExportacionFacade } from '../../../reportes/aplicacion/exportacion.facade';
import { FormatoExportacion } from '../../../reportes/dominio/puertos';
import { InventarioFacade } from '../../aplicacion/inventario.facade';
import { Categoria } from '../../dominio/categoria.model';
import {
  EquipoResumen,
  FiltroInventario,
  PESTANAS_INVENTARIO,
  PestanaCondicion,
  ResponsableEquipo,
} from '../../dominio/equipo.model';

/**
 * Listado del inventario (RF-46 .. RF-52).
 *
 * <p>Entra por la pestana <b>Todos</b>, que es el inventario entero: lo que
 * hay, sin que la pantalla decida por su cuenta esconder los equipos
 * prestados, los que estan en mantenimiento o los dados de baja (RF-47). Las
 * demas pestanas acotan desde ahi. El Administrador debe elegir primero la
 * coordinacion que quiere consultar y no ve ninguna accion de escritura
 * (RF-49, RN-22).</p>
 *
 * <p>La unica accion de la fila es abrir la ficha. Editar, enviar a
 * mantenimiento y dar de baja viven en la ficha del bien, donde
 * cada boton lleva su nombre escrito y hay sitio para explicar la consecuencia
 * antes de confirmarla (RNF-22, RNF-26).</p>
 */
@Component({
  selector: 'app-inventario',
  standalone: false,
  templateUrl: './inventario.html',
})
export class Inventario {
  private readonly inventario = inject(InventarioFacade);
  private readonly organizacion = inject(OrganizacionFacade);
  private readonly exportacion = inject(ExportacionFacade);
  private readonly sesion = inject(SesionStore);
  private readonly notificaciones = inject(NotificacionStore);
  private readonly refresco = inject(RefrescoAutomatico);
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly pestanas = PESTANAS_INVENTARIO;
  protected readonly esAdmin = this.sesion.esAdmin;
  protected readonly esOperativo = this.sesion.esOperativo;

  protected readonly pagina = signal<Pagina<EquipoResumen>>(PAGINA_VACIA);
  protected readonly categorias = signal<Categoria[]>([]);
  protected readonly coordinaciones = signal<Coordinacion[]>([]);
  /** RF-84: quién lleva equipos en esta coordinación, y cuántos lleva cada uno. */
  protected readonly responsablesEquipo = signal<ResponsableEquipo[]>([]);
  protected readonly cargando = signal(false);
  protected readonly exportando = signal(false);

  /** Estado elegido en el panel de filtros; filtra cuando se aplica. */
  protected estadoElegido: PestanaCondicion = PESTANAS_INVENTARIO[0];

  protected texto = '';
  protected categoriaId: number | null = null;
  protected coordinacionElegida: number | null = null;
  /**
   * RF-84: el listado por responsable de equipo.
   *
   * <p>Tres valores posibles: {@code null} no filtra —el inventario entero—;
   * el identificador de una persona deja solo lo que esa persona lleva a su
   * nombre; y {@code 'responsable'} deja los que no están asignados a ningún
   * operador, que son los del Responsable de la coordinación (RN-37). El
   * literal es lo que permite distinguir "sin filtro" de "los del responsable",
   * que en el servidor son dos consultas distintas y aquí serían el mismo
   * {@code null}.</p>
   */
  protected responsableEquipoElegido: number | 'responsable' | null = null;

  /**
   * Lo que filtra la tabla. Los campos del panel son un borrador hasta que se
   * pulsa Aplicar: la paginación, el orden y la exportación usan esto y no lo
   * que se esté tocando con el panel abierto.
   */
  private aplicados: {
    categoriaId: number | null;
    estado: PestanaCondicion;
    responsable: number | 'responsable' | null;
  } = { categoriaId: null, estado: PESTANAS_INVENTARIO[0], responsable: null };
  protected numeroPagina = 0;
  protected tamano = 10;
  protected ordenarPor = 'nombre';
  protected descendente = false;

  /**
   * RF-49: el Administrador consulta el inventario de una coordinacion a la
   * vez y debe elegirla antes de ver nada.
   *
   * <p>Es un metodo y no un {@code computed}: la coordinacion elegida es un
   * campo del formulario, no una señal, asi que un {@code computed} se quedaba
   * con el primer valor que leyo —"todavia no ha elegido"— y no volvia a
   * calcularse nunca, porque ninguna señal suya cambiaba. El efecto era que el
   * Administrador elegia una coordinacion y el listado seguia sin pedirse: veia
   * su inventario siempre vacio, aunque tuviera equipos (RF-46, RF-49).</p>
   */
  protected faltaElegirCoordinacion(): boolean {
    return this.esAdmin() && this.coordinacionElegida === null;
  }

  constructor() {
    // La condicion de un equipo la cambia quien lo presta, lo recibe o lo
    // manda a mantenimiento, y casi nunca es quien esta mirando la tabla: sin
    // esto, el listado envejece en pantalla y solo se entera quien recarga.
    this.refresco.alRefrescar(() => {
      this.buscar(true);
      // RF-84: quien reparte los equipos lo hace desde la ficha de cada bien, y
      // el recuento del desplegable envejece igual que la tabla.
      this.cargarResponsablesEquipo();
    });

    // El panel enlaza aquí con la condición ya elegida ("?estado=mantenimiento").
    const estadoDesdeRuta = PESTANAS_INVENTARIO.find(
      (p) => p.clave === this.ruta.snapshot.queryParamMap.get('estado'),
    );
    if (estadoDesdeRuta) {
      this.estadoElegido = estadoDesdeRuta;
      this.aplicados.estado = estadoDesdeRuta;
    }

    this.inventario.categoriasDisponibles(true).subscribe({
      next: (lista) => this.categorias.set(lista),
      error: () => this.categorias.set([]),
    });

    if (this.esAdmin()) {
      this.organizacion.coordinacionesDisponibles().subscribe({
        next: (lista) => {
          this.coordinaciones.set(lista);
          // La estructura enlaza aqui con la coordinacion ya elegida.
          const desdeRuta = Number(this.ruta.snapshot.queryParamMap.get('coordinacion'));
          if (desdeRuta && lista.some((c) => c.id === desdeRuta)) {
            this.coordinacionElegida = desdeRuta;
            this.cambiarCoordinacion();
          }
        },
        error: () => this.coordinaciones.set([]),
      });
      return;
    }

    // RF-84: "Mi equipo" enlaza aquí con el operador ya elegido, para que quien
    // venía preguntando qué lleva esa persona lo tenga delante al llegar.
    this.responsableEquipoElegido = this.responsableDesdeLaRuta();
    this.aplicados.responsable = this.responsableEquipoElegido;
    this.cargarResponsablesEquipo();
    this.buscar();
  }

  private responsableDesdeLaRuta(): number | null {
    const desdeRuta = Number(this.ruta.snapshot.queryParamMap.get('responsable'));
    return desdeRuta > 0 ? desdeRuta : null;
  }

  /**
   * RF-84: el reparto de la coordinación, para el desplegable de responsables.
   *
   * <p>Llega ya contado, de modo que la lista dice quién lleva equipos y
   * cuántos antes de que nadie elija: sin el recuento, elegir un nombre es
   * apostar a que esa persona tenga algo a su cargo (RNF-23).</p>
   */
  private cargarResponsablesEquipo(): void {
    if (this.faltaElegirCoordinacion()) {
      this.responsablesEquipo.set([]);
      return;
    }
    this.inventario.responsablesDeEquipo(this.coordinacionElegida).subscribe({
      next: (lista) => this.responsablesEquipo.set(lista),
      error: () => this.responsablesEquipo.set([]),
    });
  }

  // --------------------------------------------------------------- Consulta

  protected get filtro(): FiltroInventario {
    const pestana = this.aplicados.estado;
    const elegido = this.aplicados.responsable;
    return {
      q: this.texto.trim() || undefined,
      // El cliente solo la envia si es Administrador; para el resto la deduce
      // el servidor del token (RF-37, RNF-10).
      coordinacionId: this.esAdmin() ? this.coordinacionElegida : null,
      categoriaId: this.aplicados.categoriaId,
      laboratorioId: null,
      condicion: pestana.condicion,
      todas: pestana.todas,
      // RF-84: "los del responsable" son los que no tienen operador asignado.
      responsableEquipoId: typeof elegido === 'number' ? elegido : null,
      sinResponsable: elegido === 'responsable',
    };
  }

  /**
   * @param silencioso recarga de fondo: sin indicador de carga ni avisos de
   *                   error, para no interrumpir a quien esta leyendo la tabla.
   */
  protected buscar(silencioso = false): void {
    if (this.faltaElegirCoordinacion()) {
      this.pagina.set(PAGINA_VACIA);
      return;
    }
    if (!silencioso) {
      this.cargando.set(true);
    }
    this.inventario
      .buscar(this.filtro, {
        pagina: this.numeroPagina,
        tamano: this.tamano,
        ordenarPor: this.ordenarPor,
        descendente: this.descendente,
      })
      .subscribe({
        next: (pagina) => {
          this.pagina.set(pagina);
          this.cargando.set(false);
        },
        error: (error) => {
          if (!silencioso) {
            this.notificaciones.error(mensajeError(error, 'No se pudo cargar el inventario.'));
          }
          this.cargando.set(false);
        },
      });
  }

  /** Buscar y Aplicar: el borrador del panel pasa a filtrar la tabla. */
  protected aplicarFiltros(): void {
    this.aplicados = {
      categoriaId: this.categoriaId,
      estado: this.estadoElegido,
      responsable: this.responsableEquipoElegido,
    };
    this.numeroPagina = 0;
    this.buscar();
  }

  /** El panel se cerró sin aplicar: los campos vuelven a lo que filtra. */
  protected descartarFiltros(): void {
    this.categoriaId = this.aplicados.categoriaId;
    this.estadoElegido = this.aplicados.estado;
    this.responsableEquipoElegido = this.aplicados.responsable;
  }

  protected limpiarFiltros(): void {
    this.texto = '';
    this.categoriaId = null;
    this.responsableEquipoElegido = null;
    this.estadoElegido = PESTANAS_INVENTARIO[0];
    this.aplicarFiltros();
  }

  /** El aspa de un indicador quita ese filtro y deja los demás como estaban. */
  protected quitarFiltro(clave: string): void {
    this.descartarFiltros();
    if (clave === 'categoria') {
      this.categoriaId = null;
    } else if (clave === 'estado') {
      this.estadoElegido = PESTANAS_INVENTARIO[0];
    } else if (clave === 'responsable') {
      this.responsableEquipoElegido = null;
    }
    this.aplicarFiltros();
  }

  /** Indicadores de lo aplicado, visibles también con el panel cerrado. */
  protected get filtrosActivos(): FiltroActivo[] {
    const activos: FiltroActivo[] = [];
    const { categoriaId, estado, responsable } = this.aplicados;
    if (categoriaId !== null) {
      const categoria = this.categorias().find((c) => c.id === categoriaId);
      activos.push({ clave: 'categoria', etiqueta: 'Categoría', valor: categoria?.nombre ?? '—' });
    }
    if (!estado.todas) {
      activos.push({ clave: 'estado', etiqueta: 'Estado', valor: estado.etiqueta });
    }
    if (responsable !== null) {
      activos.push({
        clave: 'responsable',
        etiqueta: 'Responsable',
        valor: this.responsableElegidoNombre || '—',
      });
    }
    return activos;
  }

  protected cambiarCoordinacion(): void {
    // RF-84: el reparto es de cada coordinación; el operador de una no figura
    // en el inventario de otra, y arrastrar la elección dejaría el listado
    // filtrado por alguien que no sale en la lista (RN-23).
    this.responsableEquipoElegido = null;
    this.aplicados.responsable = null;
    this.cargarResponsablesEquipo();
    this.aplicarFiltros();
  }

  /** RF-50: el listado es ordenable por columna. */
  protected ordenarPorColumna(columna: string): void {
    if (this.ordenarPor === columna) {
      this.descendente = !this.descendente;
    } else {
      this.ordenarPor = columna;
      this.descendente = false;
    }
    this.buscar();
  }

  protected irAPagina(destino: number): void {
    this.numeroPagina = destino;
    this.buscar();
  }

  protected cambiarTamano(nuevo: number): void {
    this.tamano = nuevo;
    this.numeroPagina = 0;
    this.buscar();
  }

  protected get hayFiltros(): boolean {
    return (
      !!this.texto.trim() ||
      this.aplicados.categoriaId !== null ||
      !this.aplicados.estado.todas ||
      this.aplicados.responsable !== null
    );
  }

  /**
   * Qué decir cuando la vista no trae nada.
   *
   * <p>Un listado por responsable vacío no significa lo mismo que una búsqueda
   * sin resultados: dice que a esa persona no le han entregado ningún equipo, y
   * la salida no es cambiar los filtros sino repartirlos (RNF-23).</p>
   */
  protected get tituloVacio(): string {
    const persona = this.responsableElegidoNombre;
    if (persona) {
      return `${persona} no tiene equipos en esta vista`;
    }
    return this.hayFiltros
      ? 'Ningún equipo coincide con la búsqueda'
      : 'Aún no hay equipos en esta vista';
  }

  protected get mensajeVacio(): string {
    if (this.responsableElegidoNombre) {
      return (
        'Los equipos se entregan desde la ficha de cada uno, y es el responsable de la ' +
        'coordinación quien los reparte.'
      );
    }
    return this.hayFiltros
      ? 'Pruebe a limpiar los filtros o a elegir otro estado.'
      : `No hay equipos con el estado ${this.aplicados.estado.etiqueta} en este momento.`;
  }

  /** El nombre de la vista en curso, para el estado vacío y la cabecera. */
  protected get responsableElegidoNombre(): string {
    const elegido = this.aplicados.responsable;
    if (elegido === null) {
      return '';
    }
    if (elegido === 'responsable') {
      return (
        this.responsablesEquipo().find((r) => r.esResponsableCoordinacion)?.nombreCompleto ??
        'Responsable de la coordinación'
      );
    }
    return this.responsablesEquipo().find((r) => r.usuarioId === elegido)?.nombreCompleto ?? '';
  }

  // -------------------------------------------------------------- Navegacion

  protected verFicha(equipo: EquipoResumen): void {
    void this.router.navigate(['/inventario', equipo.id]);
  }

  /** RF-31: catalogo institucional de categorias. Solo Administrador. */
  protected gestionarCategorias(): void {
    void this.router.navigate(['/categorias']);
  }

  protected registrarBien(): void {
    void this.router.navigate(['/inventario/nuevo']);
  }

  // ------------------------------------------------------------- Exportacion

  /** RF-52: menu del boton "Exportar", con Excel, CSV y PDF. */
  protected readonly menuExportar = signal(false);

  protected alternarMenuExportar(evento: Event): void {
    // Sin esto el mismo clic llega al documento y cierra el menu al abrirlo.
    evento.stopPropagation();
    this.menuExportar.update((abierto) => !abierto);
  }

  /** El menu se cierra al pulsar fuera de el o con Escape (RNF-32). */
  @HostListener('document:click')
  @HostListener('document:keydown.escape')
  protected cerrarMenuExportar(): void {
    this.menuExportar.set(false);
  }

  protected exportar(formato: FormatoExportacion): void {
    this.menuExportar.set(false);
    if (this.faltaElegirCoordinacion()) {
      this.notificaciones.alerta('Elija primero la coordinación que desea exportar.');
      return;
    }
    this.exportando.set(true);
    this.exportacion.inventario(formato, this.filtro).subscribe({
      next: () => {
        this.notificaciones.exito('Reporte descargado.');
        this.exportando.set(false);
      },
      error: (error) => {
        this.notificaciones.error(mensajeError(error, 'No se pudo generar el reporte.'));
        this.exportando.set(false);
      },
    });
  }
}
