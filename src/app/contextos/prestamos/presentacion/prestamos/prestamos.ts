import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { NotificacionStore } from '../../../../compartido/aplicacion/notificacion.store';
import { RefrescoAutomatico } from '../../../../compartido/aplicacion/refresco-automatico';
import { PAGINA_VACIA, Pagina } from '../../../../compartido/dominio/pagina.model';
import { mensajeError } from '../../../../compartido/infraestructura/http/error.interceptor';
import { FiltroActivo } from '../../../../compartido/presentacion/barra-filtros/barra-filtros';
import { SesionStore } from '../../../iam/aplicacion/sesion.store';
import { OrganizacionFacade } from '../../../organizacion/aplicacion/organizacion.facade';
import { Coordinacion } from '../../../organizacion/dominio/estructura.model';
import { PrestamosFacade } from '../../aplicacion/prestamos.facade';
import { DevolucionPeticion, EstadoPrestamo, Prestamo } from '../../dominio/prestamo.model';

/** Opciones del filtro "Estado" del listado de prestamos. */
interface PestanaPrestamo {
  clave: string;
  etiqueta: string;
  estado: EstadoPrestamo | null;
  soloVencidos: boolean;
}

/**
 * "Todos" primero y activa al entrar (v3.9), igual que en el inventario: la
 * pantalla empieza por enseñar todo lo que hay y el usuario acota desde ahi.
 * El resto conserva su orden.
 */
const PESTANAS: PestanaPrestamo[] = [
  { clave: 'todos', etiqueta: 'Todos', estado: null, soloVencidos: false },
  { clave: 'activos', etiqueta: 'Activos', estado: 'ACTIVO', soloVencidos: false },
  { clave: 'vencidos', etiqueta: 'Vencidos', estado: 'ACTIVO', soloVencidos: true },
  { clave: 'devueltos', etiqueta: 'Devueltos', estado: 'DEVUELTO', soloVencidos: false },
];

/**
 * Prestamos activos e historial (RF-66 .. RF-68).
 *
 * <p>La devolucion se registra con un checklist de dos opciones claras. Si no
 * es conforme, la observacion de retorno es obligatoria: es la unica
 * constancia de en que estado volvio el bien (RN-18).</p>
 */
@Component({
  selector: 'app-prestamos',
  standalone: false,
  templateUrl: './prestamos.html',
})
export class Prestamos {
  private readonly prestamos = inject(PrestamosFacade);
  private readonly organizacion = inject(OrganizacionFacade);
  private readonly sesion = inject(SesionStore);
  private readonly notificaciones = inject(NotificacionStore);
  private readonly refresco = inject(RefrescoAutomatico);
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly pestanas = PESTANAS;
  protected readonly esAdmin = this.sesion.esAdmin;
  protected readonly esOperativo = this.sesion.esOperativo;

  protected readonly pagina = signal<Pagina<Prestamo>>(PAGINA_VACIA);
  protected readonly coordinaciones = signal<Coordinacion[]>([]);
  protected readonly cargando = signal(false);

  /** Prestamo cuya devolucion se esta registrando. */
  protected readonly devolviendo = signal<Prestamo | null>(null);
  protected readonly procesando = signal(false);
  protected conforme: boolean | null = null;
  protected observacionesRetorno = '';

  protected texto = '';
  protected dni = '';
  /** Estado elegido en el panel de filtros; filtra cuando se aplica. */
  protected estadoElegido: PestanaPrestamo = PESTANAS[0];
  /** Lo que filtra la lista: el panel es un borrador hasta pulsar Aplicar. */
  private aplicados = { dni: '', estado: PESTANAS[0] };
  protected coordinacionElegida: number | null = null;
  protected numeroPagina = 0;
  protected tamano = 10;

  /**
   * RF-68: el Administrador consulta los prestamos de una coordinacion a la
   * vez y debe elegirla antes de ver nada.
   *
   * <p>Metodo y no {@code computed}, por lo mismo que en el inventario: la
   * coordinacion elegida es un campo del formulario y no una señal, de modo
   * que el {@code computed} se quedaba con el primer valor para siempre y la
   * lista no llegaba a pedirse nunca.</p>
   */
  protected faltaElegirCoordinacion(): boolean {
    return this.esAdmin() && this.coordinacionElegida === null;
  }

  constructor() {
    // Una salida la registra uno y la devolucion la recibe otro. Los dias de
    // atraso, ademas, cambian solos con el reloj: la lista de vencidos de esta
    // manana no es la de esta tarde. Mientras haya una ventana abierta —una
    // devolucion a medio declarar— no se toca nada de lo que hay debajo.
    this.refresco.alRefrescar(() => {
      if (this.devolviendo() === null) {
        this.buscar(true);
      }
    });

    // El panel enlaza aqui con el estado ya elegido ("?estado=vencidos").
    const estadoDesdeRuta = PESTANAS.find((p) => p.clave === this.ruta.snapshot.queryParamMap.get('estado'));
    if (estadoDesdeRuta) {
      this.estadoElegido = estadoDesdeRuta;
      this.aplicados.estado = estadoDesdeRuta;
    }

    if (this.esAdmin()) {
      this.organizacion.coordinacionesDisponibles().subscribe({
        next: (lista) => {
          this.coordinaciones.set(lista);
          const desdeRuta = Number(this.ruta.snapshot.queryParamMap.get('coordinacion'));
          if (desdeRuta && lista.some((c) => c.id === desdeRuta)) {
            this.coordinacionElegida = desdeRuta;
            this.aplicarFiltros();
          }
        },
        error: () => this.coordinaciones.set([]),
      });
      return;
    }
    this.buscar();
  }

  /**
   * @param silencioso recarga de fondo: sin indicador de carga ni avisos de
   *                   error, para no interrumpir a quien esta leyendo la lista.
   */
  protected buscar(silencioso = false): void {
    if (this.faltaElegirCoordinacion()) {
      this.pagina.set(PAGINA_VACIA);
      return;
    }
    const pestana = this.aplicados.estado;
    if (!silencioso) {
      this.cargando.set(true);
    }
    this.prestamos
      .buscar(
        {
          q: this.texto.trim() || undefined,
          coordinacionId: this.esAdmin() ? this.coordinacionElegida : null,
          estado: pestana.estado,
          dni: this.aplicados.dni || null,
          vencidos: pestana.soloVencidos ? true : null,
        },
        { pagina: this.numeroPagina, tamano: this.tamano, ordenarPor: 'fechaPrestamo', descendente: true },
      )
      .subscribe({
        next: (pagina) => {
          this.pagina.set(pagina);
          this.cargando.set(false);
        },
        error: (error) => {
          if (!silencioso) {
            this.notificaciones.error(mensajeError(error, 'No se pudieron cargar los préstamos.'));
          }
          this.cargando.set(false);
        },
      });
  }

  /** Buscar y Aplicar: el borrador del panel pasa a filtrar la lista. */
  protected aplicarFiltros(): void {
    this.aplicados = { dni: this.dni.trim(), estado: this.estadoElegido };
    this.numeroPagina = 0;
    this.buscar();
  }

  /** El panel se cerró sin aplicar: los campos vuelven a lo que filtra. */
  protected descartarFiltros(): void {
    this.dni = this.aplicados.dni;
    this.estadoElegido = this.aplicados.estado;
  }

  protected limpiarFiltros(): void {
    this.texto = '';
    this.dni = '';
    this.estadoElegido = PESTANAS[0];
    this.aplicarFiltros();
  }

  protected quitarFiltro(clave: string): void {
    this.descartarFiltros();
    if (clave === 'dni') {
      this.dni = '';
    } else if (clave === 'estado') {
      this.estadoElegido = PESTANAS[0];
    }
    this.aplicarFiltros();
  }

  /** Indicadores de lo aplicado, visibles también con el panel cerrado. */
  protected get filtrosActivos(): FiltroActivo[] {
    const activos: FiltroActivo[] = [];
    if (this.aplicados.dni) {
      activos.push({ clave: 'dni', etiqueta: 'DNI', valor: this.aplicados.dni });
    }
    if (this.aplicados.estado !== PESTANAS[0]) {
      activos.push({ clave: 'estado', etiqueta: 'Estado', valor: this.aplicados.estado.etiqueta });
    }
    return activos;
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

  /**
   * Alguna fila ofrece "Registrar devolución". Solo entonces la columna de
   * acciones reserva el ancho de ese botón; sin él le basta el del icono.
   */
  protected get hayDevolucionesPendientes(): boolean {
    return this.esOperativo() && this.pagina().contenido.some((p) => p.estado === 'ACTIVO');
  }

  protected get hayFiltros(): boolean {
    return !!this.texto.trim() || this.filtrosActivos.length > 0;
  }

  protected registrarSalida(): void {
    void this.router.navigate(['/prestamos/nuevo']);
  }

  protected verBien(prestamo: Prestamo): void {
    void this.router.navigate(['/inventario', prestamo.equipoId]);
  }

  // -------------------------------------------------------------- Devolucion

  protected abrirDevolucion(prestamo: Prestamo): void {
    this.conforme = null;
    this.observacionesRetorno = '';
    this.devolviendo.set(prestamo);
  }

  protected cerrarDevolucion(): void {
    this.devolviendo.set(null);
  }

  /** RN-18: si no es conforme, la observacion de retorno es obligatoria. */
  protected get devolucionValida(): boolean {
    if (this.conforme === null) {
      return false;
    }
    return this.conforme || this.observacionesRetorno.trim().length > 0;
  }

  protected confirmarDevolucion(): void {
    const prestamo = this.devolviendo();
    if (!prestamo || !this.devolucionValida || this.procesando()) {
      return;
    }
    this.procesando.set(true);

    const peticion: DevolucionPeticion = {
      conforme: this.conforme!,
      // Una devolucion con observaciones marca el bien para revision (RN-19).
      reportaDano: !this.conforme,
      observacionesRetorno: this.observacionesRetorno.trim() || null,
    };

    this.prestamos.devolver(prestamo.id, peticion).subscribe({
      next: () => {
        this.notificaciones.exito(
          this.conforme
            ? `${prestamo.equipoNombre} volvió al inventario y esta disponible.`
            : `${prestamo.equipoNombre} volvió al inventario y quedo marcado para revisión.`,
        );
        this.procesando.set(false);
        this.devolviendo.set(null);
        this.buscar();
      },
      error: (error) => {
        this.notificaciones.error(mensajeError(error, 'No se pudo registrar la devolución.'));
        this.procesando.set(false);
      },
    });
  }
}
