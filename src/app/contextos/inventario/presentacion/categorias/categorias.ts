import { Component, inject, signal } from '@angular/core';

import { NotificacionStore } from '../../../../compartido/aplicacion/notificacion.store';
import { RefrescoAutomatico } from '../../../../compartido/aplicacion/refresco-automatico';
import {
  erroresDeCampo,
  mensajeError,
} from '../../../../compartido/infraestructura/http/error.interceptor';
import { CategoriasFacade } from '../../aplicacion/categorias.facade';
import { Categoria, CategoriaPeticion } from '../../dominio/categoria.model';

/**
 * Catalogo institucional de categorias (RF-31 .. RF-33).
 *
 * <p>Es compartido por todas las coordinaciones y solo lo administra el
 * Administrador. Una categoria con bienes activos no puede desactivarse: el
 * backend lo impide y aqui se explica el motivo (RF-33).</p>
 */
@Component({
  selector: 'app-categorias',
  standalone: false,
  templateUrl: './categorias.html',
})
export class Categorias {
  private readonly categorias = inject(CategoriasFacade);
  private readonly notificaciones = inject(NotificacionStore);
  private readonly refresco = inject(RefrescoAutomatico);

  protected readonly lista = signal<Categoria[]>([]);
  protected readonly cargando = signal(true);
  protected readonly guardando = signal(false);
  protected readonly formularioAbierto = signal(false);
  protected readonly enEdicion = signal<Categoria | null>(null);
  protected readonly errores = signal<Record<string, string>>({});
  protected readonly confirmacion = signal<Categoria | null>(null);

  protected nombre = '';
  protected descripcion = '';

  constructor() {
    this.cargar();

    // El catalogo es institucional y compartido: lo puede estar tocando otro
    // administrador mientras esta pantalla lo muestra.
    this.refresco.alRefrescar(() => {
      if (!this.formularioAbierto() && this.confirmacion() === null) {
        this.cargar(true);
      }
    });
  }

  /**
   * @param silencioso recarga de fondo: sin indicador de carga ni avisos de
   *                   error, para no interrumpir a quien esta leyendo.
   */
  protected cargar(silencioso = false): void {
    if (!silencioso) {
      this.cargando.set(true);
    }
    // Se piden todas, activas e inactivas: esta es la pantalla que las administra.
    this.categorias.listar(false).subscribe({
      next: (lista) => {
        this.lista.set(lista);
        this.cargando.set(false);
      },
      error: (error) => {
        if (!silencioso) {
          this.notificaciones.error(mensajeError(error, 'No se pudo cargar el catálogo.'));
        }
        this.cargando.set(false);
      },
    });
  }

  protected nueva(): void {
    this.enEdicion.set(null);
    this.nombre = '';
    this.descripcion = '';
    this.errores.set({});
    this.formularioAbierto.set(true);
  }

  protected editar(categoria: Categoria): void {
    this.enEdicion.set(categoria);
    this.nombre = categoria.nombre;
    this.descripcion = categoria.descripcion ?? '';
    this.errores.set({});
    this.formularioAbierto.set(true);
  }

  protected cerrar(): void {
    this.formularioAbierto.set(false);
    this.enEdicion.set(null);
  }

  protected guardar(): void {
    if (!this.nombre.trim() || this.guardando()) {
      return;
    }
    this.errores.set({});
    this.guardando.set(true);

    const peticion: CategoriaPeticion = {
      nombre: this.nombre.trim(),
      descripcion: this.descripcion.trim() || null,
    };
    const enEdicion = this.enEdicion();
    const accion = enEdicion
      ? this.categorias.editar(enEdicion.id, peticion)
      : this.categorias.crear(peticion);

    accion.subscribe({
      next: () => {
        this.notificaciones.exito(enEdicion ? 'Categoría actualizada.' : 'Categoría creada.');
        this.guardando.set(false);
        this.cerrar();
        this.cargar();
      },
      error: (error) => {
        this.errores.set(erroresDeCampo(error));
        this.notificaciones.error(mensajeError(error, 'No se pudo guardar la categoría.'));
        this.guardando.set(false);
      },
    });
  }

  protected pedirCambioEstado(categoria: Categoria): void {
    this.confirmacion.set(categoria);
  }

  protected get mensajeConfirmacion(): string {
    const categoria = this.confirmacion();
    if (!categoria) {
      return '';
    }
    return categoria.activa
      ? `"${categoria.nombre}" dejara de aparecer al registrar equipos nuevos.`
      : `"${categoria.nombre}" volvera a estar disponible al registrar equipos.`;
  }

  protected get detalleConfirmacion(): string {
    const categoria = this.confirmacion();
    if (!categoria?.activa) {
      return '';
    }
    return 'Los equipos ya clasificados con ella conservan su categoría. Si tiene equipos activos, el sistema no permitira desactivarla.';
  }

  protected confirmarCambioEstado(): void {
    const categoria = this.confirmacion();
    if (!categoria) {
      return;
    }
    this.categorias.cambiarEstado(categoria.id, !categoria.activa).subscribe({
      next: () => {
        this.notificaciones.exito(categoria.activa ? 'Categoría desactivada.' : 'Categoría activada.');
        this.confirmacion.set(null);
        this.cargar();
      },
      // RF-33: el backend explica que aun tiene bienes activos asociados.
      error: (error) => {
        this.notificaciones.error(mensajeError(error));
        this.confirmacion.set(null);
      },
    });
  }
}
