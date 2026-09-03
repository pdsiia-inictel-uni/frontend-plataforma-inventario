import { Component, EventEmitter, Input, Output, inject } from '@angular/core';

import { SesionStore } from '../../aplicacion/sesion.store';
import { Usuario, claseEstadoCuenta, claseRol, coordinacionDe } from '../../dominio/usuario.model';

/**
 * Ficha completa de una persona (RF-28f).
 *
 * <p>La lista de personas responde a "quien hay"; esta ventana, a "quien es
 * esta". Alli caben el nombre, el rol y el estado de la cuenta —lo que sirve
 * para encontrar a alguien y ver de un vistazo si puede trabajar—; el DNI, el
 * correo, la coordinacion y las fechas viven aqui, que es donde se consultan
 * cuando ya se ha encontrado a la persona.</p>
 *
 * <p>Aqui vive tambien <b>Editar</b>, y con el las acciones sobre sus
 * credenciales. Estan detras de la ficha a proposito: corregir el DNI de
 * alguien o restablecerle la contrasena son cosas que se hacen mirando sus
 * datos, no recorriendo una tabla (RNF-22).</p>
 */
@Component({
  selector: 'app-detalle-persona',
  standalone: false,
  templateUrl: './detalle-persona.html',
})
export class DetallePersona {
  private readonly sesion = inject(SesionStore);

  @Input({ required: true }) persona!: Usuario;

  @Output() editar = new EventEmitter<Usuario>();
  @Output() asignar = new EventEmitter<Usuario>();
  @Output() restablecerPassword = new EventEmitter<Usuario>();
  @Output() desbloquear = new EventEmitter<Usuario>();
  /** RF-22b: apartar temporalmente a quien va a volver, o traerlo de vuelta. */
  @Output() suspender = new EventEmitter<Usuario>();
  /** RF-22b: la salida de la institucion, que ademas libera el puesto (RN-34). */
  @Output() darDeBaja = new EventEmitter<Usuario>();
  @Output() reincorporar = new EventEmitter<Usuario>();
  @Output() cerrado = new EventEmitter<void>();

  /** RNF-30: el rol se distingue por color Y por texto. */
  protected get claseDelRol(): string {
    return claseRol(this.persona.rol);
  }

  /** RNF-30: y el estado de la cuenta, tambien. */
  protected get claseDelEstado(): string {
    return claseEstadoCuenta(this.persona.estado);
  }

  /** RN-05: una sola coordinacion, o ninguna. */
  protected get coordinacion(): string {
    return coordinacionDe(this.persona);
  }

  /**
   * RN-33: quien reparte los puestos no es quien los recibe.
   *
   * <p>La ficha propia se consulta como cualquier otra, pero no ofrece
   * cambiarse el puesto a uno mismo: eso lo decide otro administrador.</p>
   */
  protected get esUnoMismo(): boolean {
    return this.sesion.usuario()?.id === this.persona.id;
  }
}
