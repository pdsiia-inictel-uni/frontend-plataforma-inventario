import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { NotificacionStore } from '../../../../compartido/aplicacion/notificacion.store';
import {
  erroresDeCampo,
  mensajeError,
} from '../../../../compartido/infraestructura/http/error.interceptor';
import { EquipoResumen } from '../../../inventario/dominio/equipo.model';
import { PrestamosFacade } from '../../aplicacion/prestamos.facade';
import {
  CoordinacionDestino,
  Destinatario,
  GrupoDestino,
  PrestamoPeticion,
} from '../../dominio/prestamo.model';

/**
 * Registro de una salida (RF-58, RF-59).
 *
 * <p>Solo ofrece los bienes en condicion OPERATIVO de la coordinacion del
 * usuario, presentados con la etiqueta "Disponible" (RNF-29). Un bien que no
 * se puede prestar no aparece en la lista, en lugar de aparecer y fallar al
 * confirmar (RNF-23).</p>
 *
 * <p>El equipo se entrega a una persona <b>registrada</b>: primero se elige la
 * coordinacion de destino —cualquiera de la institucion— y despues, dentro de
 * ella, a su Responsable o a uno de sus Operadores activos. El nombre y el DNI
 * los pone el servidor a partir de esa persona.</p>
 *
 * <p>La fecha y hora de salida y el usuario que entrega los pone el servidor
 * (RN-21); el formulario no los pregunta.</p>
 */
@Component({
  selector: 'app-formulario-prestamo',
  standalone: false,
  templateUrl: './formulario-prestamo.html',
})
export class FormularioPrestamo {
  private readonly prestamos = inject(PrestamosFacade);
  private readonly notificaciones = inject(NotificacionStore);
  private readonly router = inject(Router);

  protected readonly disponibles = signal<EquipoResumen[]>([]);
  protected readonly cargando = signal(true);
  protected readonly guardando = signal(false);
  protected readonly errores = signal<Record<string, string>>({});

  /** RF-59: la fecha estimada no puede ser anterior a hoy. */
  protected readonly hoy = new Date().toISOString().slice(0, 10);

  protected readonly coordinaciones = signal<CoordinacionDestino[]>([]);

  /**
   * Las coordinaciones agrupadas por Dirección: el destino puede estar en la
   * misma Dirección o en otra, y el selector lo deja a la vista.
   */
  protected readonly gruposDestino = computed<GrupoDestino[]>(() => {
    const grupos = new Map<string, CoordinacionDestino[]>();
    for (const coordinacion of this.coordinaciones()) {
      const direccion = coordinacion.direccionNombre ?? 'Sin dirección';
      grupos.set(direccion, [...(grupos.get(direccion) ?? []), coordinacion]);
    }
    return [...grupos.entries()].map(([direccion, coordinaciones]) => ({ direccion, coordinaciones }));
  });
  protected readonly cargandoCoordinaciones = signal(true);
  protected readonly destinatarios = signal<Destinatario[]>([]);
  protected readonly cargandoDestinatarios = signal(false);

  protected busqueda = '';
  protected equipoId: number | null = null;
  protected coordinacionDestinoId: number | null = null;
  protected personaUsuarioId: number | null = null;
  protected fechaEstimadaDevolucion = '';
  protected observacionesSalida = '';

  constructor() {
    this.cargarDisponibles();
    this.cargarCoordinaciones();
  }

  private cargarCoordinaciones(): void {
    this.cargandoCoordinaciones.set(true);
    // Lista propia de los préstamos: la general de coordinaciones solo trae la
    // del usuario (RN-23), y el destino puede ser cualquiera de la institución.
    this.prestamos.coordinacionesDestino().subscribe({
      next: (lista) => {
        this.coordinaciones.set(lista);
        this.cargandoCoordinaciones.set(false);
      },
      error: (error) => {
        this.notificaciones.error(mensajeError(error, 'No se pudieron cargar las coordinaciones.'));
        this.cargandoCoordinaciones.set(false);
      },
    });
  }

  /** Al cambiar de coordinación se limpia la persona: la lista es otra. */
  protected alElegirCoordinacion(): void {
    this.personaUsuarioId = null;
    this.destinatarios.set([]);
    const coordinacionId = this.coordinacionDestinoId;
    if (coordinacionId === null) {
      return;
    }
    this.cargandoDestinatarios.set(true);
    this.prestamos.destinatarios(coordinacionId).subscribe({
      next: (lista) => {
        // La respuesta de una coordinación que ya no está elegida no pisa a la actual.
        if (this.coordinacionDestinoId === coordinacionId) {
          this.destinatarios.set(lista);
        }
        this.cargandoDestinatarios.set(false);
      },
      error: (error) => {
        this.notificaciones.error(
          mensajeError(error, 'No se pudo cargar el personal de la coordinación.'),
        );
        this.cargandoDestinatarios.set(false);
      },
    });
  }

  protected cargarDisponibles(): void {
    this.cargando.set(true);
    this.prestamos.bienesDisponibles(this.busqueda.trim() || undefined).subscribe({
      next: (pagina) => {
        this.disponibles.set(pagina.contenido);
        this.cargando.set(false);
      },
      error: (error) => {
        this.notificaciones.error(mensajeError(error, 'No se pudieron cargar los equipos.'));
        this.cargando.set(false);
      },
    });
  }

  protected elegir(equipo: EquipoResumen): void {
    this.equipoId = this.equipoId === equipo.id ? null : equipo.id;
  }

  protected get equipoElegido(): EquipoResumen | null {
    return this.disponibles().find((e) => e.id === this.equipoId) ?? null;
  }

  /** Texto de la opción vacía del selector de persona, según lo que falte. */
  protected get textoSinPersona(): string {
    if (this.coordinacionDestinoId === null) {
      return 'Primero elija la coordinación';
    }
    if (this.cargandoDestinatarios()) {
      return 'Cargando personal...';
    }
    return this.destinatarios().length === 0 ? 'Sin personal activo' : 'Seleccione a la persona';
  }

  protected get fechaValida(): boolean {
    if (!this.fechaEstimadaDevolucion) {
      return true;
    }
    return this.fechaEstimadaDevolucion >= this.hoy;
  }

  protected get valido(): boolean {
    return (
      this.equipoId !== null &&
      this.coordinacionDestinoId !== null &&
      this.personaUsuarioId !== null &&
      this.fechaValida
    );
  }

  protected registrar(): void {
    if (!this.valido || this.guardando()) {
      return;
    }
    this.errores.set({});
    this.guardando.set(true);

    const peticion: PrestamoPeticion = {
      equipoId: this.equipoId!,
      coordinacionDestinoId: this.coordinacionDestinoId!,
      personaUsuarioId: this.personaUsuarioId!,
      fechaEstimadaDevolucion: this.fechaEstimadaDevolucion || null,
      observacionesSalida: this.observacionesSalida.trim() || null,
    };

    this.prestamos.registrar(peticion).subscribe({
      next: (prestamo) => {
        this.guardando.set(false);
        // RNF-31: se confirma que ocurrio y que cambio.
        this.notificaciones.exito(
          `${prestamo.equipoNombre} quedo prestado a ${prestamo.nombrePersona}.`,
        );
        void this.router.navigate(['/prestamos']);
      },
      error: (error) => {
        this.errores.set(erroresDeCampo(error));
        this.guardando.set(false);
        this.notificaciones.error(mensajeError(error, 'No se pudo registrar el préstamo.'));
      },
    });
  }

  protected cancelar(): void {
    void this.router.navigate(['/prestamos']);
  }
}
