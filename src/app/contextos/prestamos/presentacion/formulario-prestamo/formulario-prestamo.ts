import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { NotificacionStore } from '../../../../compartido/aplicacion/notificacion.store';
import {
  erroresDeCampo,
  mensajeError,
} from '../../../../compartido/infraestructura/http/error.interceptor';
import { EquipoResumen } from '../../../inventario/dominio/equipo.model';
import { PrestamosFacade } from '../../aplicacion/prestamos.facade';
import { PrestamoPeticion } from '../../dominio/prestamo.model';

/**
 * Registro de una salida (RF-58, RF-59).
 *
 * <p>Solo ofrece los bienes en condicion OPERATIVO de la coordinacion del
 * usuario, presentados con la etiqueta "Disponible" (RNF-29). Un bien que no
 * se puede prestar no aparece en la lista, en lugar de aparecer y fallar al
 * confirmar (RNF-23).</p>
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

  protected busqueda = '';
  protected equipoId: number | null = null;
  protected nombrePersona = '';
  protected dniPersona = '';
  protected destino = '';
  protected fechaEstimadaDevolucion = '';
  protected observacionesSalida = '';

  constructor() {
    this.cargarDisponibles();
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

  protected get dniValido(): boolean {
    return /^[0-9]{8}$/.test(this.dniPersona.trim());
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
      this.nombrePersona.trim().length > 0 &&
      this.dniValido &&
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
      nombrePersona: this.nombrePersona.trim(),
      dniPersona: this.dniPersona.trim(),
      destino: this.destino.trim() || null,
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
