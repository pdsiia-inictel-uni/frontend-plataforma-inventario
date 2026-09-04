import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';

import { SesionStore } from '../../aplicacion/sesion.store';
import { UsuariosFacade } from '../../aplicacion/usuarios.facade';
import {
  EquiposACargo,
  Usuario,
  claseEstadoCuenta,
  claseRol,
  coordinacionDe,
} from '../../dominio/usuario.model';

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
  private readonly usuarios = inject(UsuariosFacade);

  /**
   * RN-38: los equipos que retienen a esta persona en su puesto.
   *
   * <p>Se consultan al abrir la ficha, no al pulsar "Dar de baja": la ventana
   * tiene que poder decir que la baja no procede <b>antes</b> de que nadie lo
   * intente, y decir además cuáles son los equipos, que es lo que hay que
   * reasignar para desbloquearla (RNF-23, RNF-26).</p>
   */
  protected readonly aCargo = signal<EquiposACargo | null>(null);

  @Input({ required: true }) set persona(valor: Usuario) {
    this.personaActual = valor;
    this.aCargo.set(null);
    // Quien ya está de baja no tiene nada que retenerlo: la pregunta no aplica.
    if (valor.estado === 'BAJA') {
      return;
    }
    this.usuarios.equiposACargo(valor.id).subscribe({
      next: (respuesta) => this.aCargo.set(respuesta),
      // Sin respuesta la ficha no bloquea nada: el servidor sigue siendo quien
      // decide, y rechazará la baja si corresponde (RNF-10).
      error: () => this.aCargo.set(null),
    });
  }

  get persona(): Usuario {
    return this.personaActual;
  }

  private personaActual!: Usuario;

  @Output() editar = new EventEmitter<Usuario>();
  @Output() asignar = new EventEmitter<Usuario>();
  @Output() restablecerPassword = new EventEmitter<Usuario>();
  @Output() desbloquear = new EventEmitter<Usuario>();
  /** RF-22b: la salida de la institucion, que ademas libera el puesto (RN-34). */
  @Output() darDeBaja = new EventEmitter<Usuario>();
  @Output() reincorporar = new EventEmitter<Usuario>();
  @Output() cerrado = new EventEmitter<void>();

  /** RN-38: mientras conserve algún equipo, la baja se rechazaría. */
  protected get retenidoPorSusEquipos(): boolean {
    return (this.aCargo()?.cantidad ?? 0) > 0;
  }

  /**
   * El aviso que acompaña al botón desactivado.
   *
   * <p>Dice el hecho —cuántos equipos la retienen— y la lista que sigue los
   * nombra. Quién debe repartirlos y cómo no se repite aquí: lo lee un
   * Responsable, que es precisamente quien los reparte, y la salida está en la
   * ficha de cada equipo, un clic más allá (RN-38, RF-83).</p>
   */
  protected get motivoBloqueoBaja(): string {
    const cantidad = this.aCargo()?.cantidad ?? 0;
    if (cantidad === 0) {
      return '';
    }
    const equipos = cantidad === 1 ? 'un equipo' : `${cantidad} equipos`;
    return `No se puede dar de baja: tiene ${equipos} a su cargo.`;
  }

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
