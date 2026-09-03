import { Component, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';

import { NotificacionStore } from '../../../../compartido/aplicacion/notificacion.store';
import { mensajeError } from '../../../../compartido/infraestructura/http/error.interceptor';
import { SesionStore } from '../../../iam/aplicacion/sesion.store';
import { UsuariosFacade } from '../../../iam/aplicacion/usuarios.facade';
import { Usuario } from '../../../iam/dominio/usuario.model';
import { InventarioFacade } from '../../aplicacion/inventario.facade';
import { Equipo } from '../../dominio/equipo.model';

/**
 * Responsable del equipo (RF-83).
 *
 * <p>Cada bien está a cargo de alguien concreto, y ese alguien es un
 * <b>Operador</b> de la coordinación o el propio <b>Responsable</b>. Quien lo
 * decide es siempre el Responsable: es quien reparte el trabajo y quien
 * responde por el inventario entero (RN-37).</p>
 *
 * <p>La lista ofrece solo operadores <b>activos</b>: a quien está dado de baja
 * no se le entrega un equipo, y ofrecerlo sería ofrecer una acción que el
 * servidor rechazaría (RNF-23).</p>
 *
 * <p><b>Devolverlo al Responsable no es dejarlo huérfano.</b> Es lo que hay
 * que hacer antes de que un operador con equipos a su nombre pueda dejar su
 * puesto o cambiar de coordinación, y la ventana lo dice (RN-38).</p>
 */
@Component({
  selector: 'app-responsable-equipo',
  standalone: false,
  templateUrl: './responsable-equipo.html',
})
export class ResponsableEquipo implements OnInit {
  private readonly inventario = inject(InventarioFacade);
  private readonly usuarios = inject(UsuariosFacade);
  private readonly sesion = inject(SesionStore);
  private readonly notificaciones = inject(NotificacionStore);

  @Input({ required: true }) equipo!: Equipo;

  @Output() asignado = new EventEmitter<Equipo>();
  @Output() cancelado = new EventEmitter<void>();

  protected readonly operadores = signal<Usuario[]>([]);
  protected readonly cargando = signal(true);
  protected readonly guardando = signal(false);

  /** Quién queda a cargo: el id de un operador, o null para el Responsable. */
  protected elegido: number | null = null;

  ngOnInit(): void {
    this.elegido = this.equipo.responsableEquipoId ?? null;
    this.cargarOperadores();
  }

  private cargarOperadores(): void {
    const coordinacionId = this.sesion.coordinacionId();
    if (!coordinacionId) {
      this.cargando.set(false);
      return;
    }
    // soloActivos: a quien está dado de baja no se le entrega nada.
    this.usuarios.integrantesDe(coordinacionId, true).subscribe({
      next: (lista) => {
        this.operadores.set(lista.filter((persona) => persona.rol === 'OPERADOR'));
        this.cargando.set(false);
      },
      error: () => {
        this.operadores.set([]);
        this.cargando.set(false);
      },
    });
  }

  protected get nombreActual(): string {
    return this.equipo.responsableEquipo ?? 'Sin responsable asignado';
  }

  protected get loLlevaElResponsable(): boolean {
    return this.equipo.responsableEquipoId == null;
  }

  /** Sin operadores activos no hay a quién entregarle nada (RNF-24). */
  protected get sinOperadores(): boolean {
    return !this.cargando() && this.operadores().length === 0;
  }

  protected get hayCambio(): boolean {
    return this.elegido !== (this.equipo.responsableEquipoId ?? null);
  }

  protected get puedeGuardar(): boolean {
    return this.hayCambio && !this.guardando();
  }

  /** El texto del botón dice exactamente lo que va a ocurrir (RNF-31). */
  protected get textoConfirmar(): string {
    if (this.guardando()) {
      return 'Guardando...';
    }
    return this.elegido === null ? 'Dejarlo a mi cargo' : 'Entregar el equipo';
  }

  protected guardar(): void {
    if (!this.puedeGuardar) {
      return;
    }
    this.guardando.set(true);
    this.inventario.asignarResponsableDeEquipo(this.equipo.id, this.elegido).subscribe({
      next: (actualizado) => {
        this.guardando.set(false);
        this.notificaciones.exito(
          `${actualizado.nombre} queda a cargo de ${actualizado.responsableEquipo}.`,
        );
        this.asignado.emit(actualizado);
      },
      error: (error) => {
        this.guardando.set(false);
        this.notificaciones.error(mensajeError(error, 'No se pudo cambiar el responsable.'));
      },
    });
  }
}
