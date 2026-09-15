import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { NotificacionStore } from '../../../../compartido/aplicacion/notificacion.store';
import { RefrescoAutomatico } from '../../../../compartido/aplicacion/refresco-automatico';
import { mensajeError } from '../../../../compartido/infraestructura/http/error.interceptor';
import { SesionStore } from '../../../iam/aplicacion/sesion.store';
import { PanelFacade } from '../../aplicacion/panel.facade';
import { Conteo, PanelControl } from '../../dominio/panel.model';

/** Una cifra del panel: el numero, que es, y adonde lleva al pulsarla. */
interface Cifra {
  valor: number;
  etiqueta: string;
  /** Una frase corta que explica la cifra. */
  ayuda: string;
  /** Rojo solo cuando la cifra es un problema (mayor que cero). */
  alerta: boolean;
  ruta: string;
  parametros?: Record<string, string>;
}

/** Un tramo de la barra de condiciones, con su enlace al inventario filtrado. */
interface TramoCondicion {
  etiqueta: string;
  cantidad: number;
  porcentaje: number;
  tono: 'verde' | 'azul' | 'ambar' | 'gris';
  /** Clave de la pestana del inventario ("?estado="). */
  estado: string;
}

/** Categorias que se listan antes de agrupar el resto en una sola fila. */
const CATEGORIAS_VISIBLES = 6;

/**
 * Panel de control (RF-75 .. RF-77).
 *
 * <p>Un solo componente con tres caras, porque los tres roles preguntan cosas
 * distintas: el Administrador quiere saber si la institucion esta bien
 * armada, el Responsable como esta su inventario y el Operador como esta el
 * laboratorio.</p>
 *
 * <p>Sin cabecera: el panel empieza por una franja de cifras y sigue con dos
 * cuadros de filas, el estado de los equipos y su reparto por categoria.</p>
 */
@Component({
  selector: 'app-panel',
  standalone: false,
  templateUrl: './panel.html',
})
export class Panel {
  private readonly panel = inject(PanelFacade);
  private readonly sesion = inject(SesionStore);
  private readonly notificaciones = inject(NotificacionStore);
  private readonly refresco = inject(RefrescoAutomatico);
  private readonly router = inject(Router);

  protected readonly esAdmin = this.sesion.esAdmin;
  protected readonly esOperador = this.sesion.esOperador;

  protected readonly resumen = signal<PanelControl | null>(null);
  protected readonly cargando = signal(true);

  /** Las cifras principales, distintas para cada rol. */
  protected readonly cifras = computed<Cifra[]>(() => {
    const r = this.resumen();
    if (!r) {
      return [];
    }
    const vencidos: Cifra = {
      valor: r.prestamosVencidos,
      etiqueta: 'Préstamos vencidos',
      ayuda: r.prestamosVencidos > 0 ? 'Pasaron su fecha de devolución' : 'Todo al día',
      alerta: r.prestamosVencidos > 0,
      ruta: '/prestamos',
      parametros: { estado: 'vencidos' },
    };
    const porDevolver: Cifra = {
      valor: r.prestamosActivos,
      etiqueta: 'Préstamos por devolver',
      ayuda: 'Equipos fuera del laboratorio',
      alerta: false,
      ruta: '/prestamos',
      parametros: { estado: 'activos' },
    };

    if (this.esAdmin()) {
      return [
        {
          valor: r.coordinaciones,
          etiqueta: 'Coordinaciones',
          ayuda: `En ${r.direcciones} ${r.direcciones === 1 ? 'dirección' : 'direcciones'}`,
          alerta: false,
          ruta: '/direcciones',
        },
        {
          valor: r.laboratorios,
          etiqueta: 'Laboratorios',
          ayuda: 'Ubicaciones registradas',
          alerta: false,
          ruta: '/direcciones',
        },
        {
          valor: r.usuarios,
          etiqueta: 'Personas con cuenta',
          ayuda: 'Cuentas activas del sistema',
          alerta: false,
          ruta: '/personas',
        },
        {
          valor: r.sinResponsable,
          etiqueta: 'Sin responsable',
          ayuda: r.sinResponsable > 0 ? 'Coordinaciones paradas' : 'Todas tienen responsable',
          alerta: r.sinResponsable > 0,
          ruta: '/direcciones',
        },
      ];
    }

    if (this.esOperador()) {
      return [
        {
          valor: r.operativos,
          etiqueta: 'Equipos disponibles',
          ayuda: 'Listos para prestar',
          alerta: false,
          ruta: '/inventario',
          parametros: { estado: 'operativos' },
        },
        porDevolver,
        vencidos,
      ];
    }

    return [
      {
        valor: r.totalBienes,
        etiqueta: 'Equipos registrados',
        ayuda: `${r.operativos} disponibles ahora`,
        alerta: false,
        ruta: '/inventario',
      },
      porDevolver,
      vencidos,
      // RN-19: devueltos con dano, esperando la decision del Responsable.
      {
        valor: r.revisionPendiente,
        etiqueta: 'Equipos por revisar',
        ayuda: r.revisionPendiente > 0 ? 'Volvieron con observaciones' : 'Nada pendiente',
        alerta: r.revisionPendiente > 0,
        ruta: '/inventario',
      },
    ];
  });

  /** Las cuatro condiciones, cada una con su parte del total. */
  protected readonly tramos = computed<TramoCondicion[]>(() => {
    const r = this.resumen();
    if (!r) {
      return [];
    }
    const total = r.operativos + r.prestados + r.enMantenimiento + r.dadosDeBaja;
    const tramo = (etiqueta: string, cantidad: number, tono: TramoCondicion['tono'], estado: string) => ({
      etiqueta,
      cantidad,
      tono,
      estado,
      porcentaje: total > 0 ? (cantidad / total) * 100 : 0,
    });
    return [
      tramo('Operativos', r.operativos, 'verde', 'operativos'),
      tramo('Prestados', r.prestados, 'azul', 'prestados'),
      tramo('En mantenimiento', r.enMantenimiento, 'ambar', 'mantenimiento'),
      tramo('Dados de baja', r.dadosDeBaja, 'gris', 'baja'),
    ];
  });

  /** De mayor a menor; lo que no entra se suma en una ultima fila. */
  protected readonly categorias = computed(() => {
    const lista = [...(this.resumen()?.porCategoria ?? [])].sort(
      (a, b) => b.cantidad - a.cantidad || a.etiqueta.localeCompare(b.etiqueta),
    );
    const visibles = lista.slice(0, CATEGORIAS_VISIBLES);
    const resto = lista.slice(CATEGORIAS_VISIBLES);
    const otras: Conteo | null = resto.length
      ? {
          etiqueta: resto.length === 1 ? resto[0].etiqueta : `Otras ${resto.length} categorías`,
          cantidad: resto.reduce((suma, c) => suma + c.cantidad, 0),
        }
      : null;
    const mayor = Math.max(1, ...visibles.map((c) => c.cantidad), otras?.cantidad ?? 0);
    return { visibles, otras, mayor };
  });

  constructor() {
    this.cargar();
    // Un panel es un recuento: nace viejo. Lo que cuenta —equipos prestados,
    // vencidos, coordinaciones sin responsable— lo cambia otra persona en otra
    // pantalla, y el numero que se queda quieto no avisa de que ya no es cierto.
    this.refresco.alRefrescar(() => this.cargar(true));
  }

  /**
   * @param silencioso recarga de fondo: sin indicador de carga ni avisos de
   *                   error, para no interrumpir a quien esta leyendo.
   */
  protected cargar(silencioso = false): void {
    if (!silencioso) {
      this.cargando.set(true);
    }
    this.panel.resumen().subscribe({
      next: (resumen) => {
        this.resumen.set(resumen);
        this.cargando.set(false);
      },
      error: (error) => {
        if (!silencioso) {
          this.notificaciones.error(mensajeError(error, 'No se pudo cargar el panel.'));
        }
        this.cargando.set(false);
      },
    });
  }

  /** Ancho de una barra de categoria; nunca 0, para que una categoria con un equipo se vea. */
  protected ancho(cantidad: number, mayor: number): number {
    return Math.max(2, Math.round((cantidad / mayor) * 100));
  }

  protected irA(ruta: string, parametros?: Record<string, string>): void {
    void this.router.navigate([ruta], parametros ? { queryParams: parametros } : {});
  }
}
