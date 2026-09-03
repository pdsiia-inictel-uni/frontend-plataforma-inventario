import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { NotificacionStore } from '../../../../compartido/aplicacion/notificacion.store';
import { RefrescoAutomatico } from '../../../../compartido/aplicacion/refresco-automatico';
import { PAGINA_VACIA, Pagina } from '../../../../compartido/dominio/pagina.model';
import { mensajeError } from '../../../../compartido/infraestructura/http/error.interceptor';
import { SesionStore } from '../../../iam/aplicacion/sesion.store';
import { OrganizacionFacade } from '../../../organizacion/aplicacion/organizacion.facade';
import { Coordinacion, Laboratorio } from '../../../organizacion/dominio/estructura.model';
import { ExportacionFacade } from '../../../reportes/aplicacion/exportacion.facade';
import { FormatoExportacion } from '../../../reportes/dominio/puertos';
import { InventarioFacade } from '../../aplicacion/inventario.facade';
import { Categoria } from '../../dominio/categoria.model';
import {
  EquipoResumen,
  FiltroInventario,
  PESTANAS_INVENTARIO,
  PestanaCondicion,
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
 * mantenimiento, dar de baja y reincorporar viven en la ficha del bien, donde
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
  protected readonly laboratorios = signal<Laboratorio[]>([]);
  protected readonly coordinaciones = signal<Coordinacion[]>([]);
  protected readonly cargando = signal(false);
  protected readonly exportando = signal(false);

  protected readonly pestanaActiva = signal<PestanaCondicion>(PESTANAS_INVENTARIO[0]);

  protected texto = '';
  protected categoriaId: number | null = null;
  protected laboratorioId: number | null = null;
  protected coordinacionElegida: number | null = null;
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
    this.refresco.alRefrescar(() => this.buscar(true));

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

    const propia = this.sesion.coordinacionId();
    if (propia) {
      this.cargarLaboratorios(propia);
    }
    this.buscar();
  }

  // --------------------------------------------------------------- Consulta

  protected get filtro(): FiltroInventario {
    const pestana = this.pestanaActiva();
    return {
      q: this.texto.trim() || undefined,
      // El cliente solo la envia si es Administrador; para el resto la deduce
      // el servidor del token (RF-37, RNF-10).
      coordinacionId: this.esAdmin() ? this.coordinacionElegida : null,
      categoriaId: this.categoriaId,
      laboratorioId: this.laboratorioId,
      condicion: pestana.condicion,
      todas: pestana.todas,
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

  protected elegirPestana(pestana: PestanaCondicion): void {
    this.pestanaActiva.set(pestana);
    this.numeroPagina = 0;
    this.buscar();
  }

  protected aplicarFiltros(): void {
    this.numeroPagina = 0;
    this.buscar();
  }

  protected limpiarFiltros(): void {
    this.texto = '';
    this.categoriaId = null;
    this.laboratorioId = null;
    this.aplicarFiltros();
  }

  protected cambiarCoordinacion(): void {
    this.laboratorioId = null;
    this.laboratorios.set([]);
    if (this.coordinacionElegida) {
      this.cargarLaboratorios(this.coordinacionElegida);
    }
    this.aplicarFiltros();
  }

  private cargarLaboratorios(coordinacionId: number): void {
    this.organizacion.listarLaboratorios(coordinacionId, true).subscribe({
      next: (lista) => this.laboratorios.set(lista),
      error: () => this.laboratorios.set([]),
    });
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
    return !!this.texto.trim() || this.categoriaId !== null || this.laboratorioId !== null;
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

  protected exportar(formato: FormatoExportacion): void {
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
