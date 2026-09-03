import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { CriterioPagina, Pagina } from '../../../compartido/dominio/pagina.model';
import { UsuariosPuerto } from '../dominio/puertos';
import {
  AsignacionPeticion,
  AsignacionRealizada,
  EquiposACargo,
  EstadoCuenta,
  FiltroUsuarios,
  PasswordTemporal,
  Usuario,
  UsuarioPeticion,
} from '../dominio/usuario.model';

/**
 * Casos de uso de la gestion de personas (RF-16 .. RF-30).
 *
 * <p>Desde la v3.3 el alta y el puesto son dos actos distintos: {@link crear}
 * registra a la persona (RF-16b) y {@link asignar} le da rol, coordinacion y
 * contrasena (RF-28d). El relevo de responsable no tiene caso de uso propio:
 * asignar el puesto de una coordinacion que ya lo tiene <em>es</em> el
 * relevo, y el servidor lo aplica en una sola transaccion (RN-08).</p>
 */
@Injectable({ providedIn: 'root' })
export class UsuariosFacade {
  private readonly usuarios = inject(UsuariosPuerto);

  buscar(filtro: FiltroUsuarios, criterio: CriterioPagina): Observable<Pagina<Usuario>> {
    return this.usuarios.listar(filtro, criterio);
  }

  /** RF-29: el responsable y sus operadores, en una sola seccion. */
  integrantesDe(coordinacionId: number, soloActivos = false): Observable<Usuario[]> {
    return this.usuarios.integrantes(coordinacionId, soloActivos);
  }

  obtener(id: number): Observable<Usuario> {
    return this.usuarios.obtener(id);
  }

  /** RF-16b: registro previo. La persona existe, pero aun no puede entrar. */
  crear(peticion: UsuarioPeticion): Observable<Usuario> {
    return this.usuarios.crear(peticion);
  }

  editar(id: number, peticion: UsuarioPeticion): Observable<Usuario> {
    return this.usuarios.editar(id, peticion);
  }

  /** RF-28d: le da a la persona su puesto y, si lo estrena, su contrasena. */
  asignar(id: number, peticion: AsignacionPeticion): Observable<AsignacionRealizada> {
    return this.usuarios.asignar(id, peticion);
  }

  /** RF-28d: la retira de una coordinacion. Dejar un puesto no es dejar la casa. */
  retirar(id: number, coordinacionId: number): Observable<Usuario> {
    return this.usuarios.retirar(id, coordinacionId);
  }

  /**
   * RF-16e: registra a la persona y le da su puesto de un tiron.
   *
   * <p>Lo usa "Mi equipo humano": el Responsable que da de alta a un operador
   * suyo ya sabe donde va a trabajar —en su coordinacion, la unica que
   * administra—, asi que preguntarselo en dos pasos seria preguntar dos veces
   * lo mismo (RNF-22). En la pantalla de Personas los dos actos siguen
   * separados, porque alli el puesto es justamente lo que esta por decidir.</p>
   *
   * <p><b>Una peticion, no dos (v3.9).</b> Hasta la v3.8 esto encadenaba el
   * alta y la asignacion desde el navegador, y las dos podian fallar por
   * separado: cuando fallaba la segunda —la coordinacion desactivada, un
   * corte de red, la sesion caducada entre una y otra— la persona quedaba
   * registrada sin puesto. El Responsable no la veia en ninguna pantalla
   * (su lista esta acotada a su coordinacion y ella no tenia ninguna) y
   * tampoco podia repetir el alta, porque su DNI, su correo y su usuario ya
   * estaban ocupados por esa fila fantasma. Ahora las dos viajan juntas y el
   * servidor las hace en una transaccion.</p>
   */
  registrarYAsignar(
    peticion: UsuarioPeticion,
    puesto: AsignacionPeticion,
  ): Observable<AsignacionRealizada> {
    return this.usuarios.crearConPuesto(peticion, puesto);
  }

  /**
   * RF-22b, RN-09: los usuarios nunca se eliminan, solo cambian de estado.
   *
   * <p>Dar de baja es la salida de la institución, y libera el puesto. Volver a
   * ACTIVA reincorpora —sin puesto— a quien estaba de baja: el que tenía se
   * cubrió cuando se fue, y devolvérselo es una decisión aparte (RF-28d).</p>
   */
  cambiarEstado(id: number, estado: EstadoCuenta): Observable<Usuario> {
    return this.usuarios.cambiarEstado(id, estado);
  }

  /**
   * RN-38: los equipos que impiden dar de baja a esta persona.
   *
   * <p>Quien tiene bienes a su nombre no deja su puesto: antes, el Responsable
   * de su coordinación tiene que entregárselos a otro operador o quedárselos.
   * La ficha lo consulta para decirlo <b>antes</b> de que nadie pulse el botón
   * (RNF-23, RNF-26).</p>
   */
  equiposACargo(id: number): Observable<EquiposACargo> {
    return this.usuarios.equiposACargo(id);
  }

  /** RF-26b: quienes pueden hacerse cargo de una coordinacion (RN-35). */
  candidatosAResponsable(coordinacionId: number): Observable<Usuario[]> {
    return this.usuarios.candidatosAResponsable(coordinacionId);
  }

  /**
   * RF-26b: pone a otra persona al frente de la coordinacion.
   *
   * <p>Un solo acto y una sola transaccion: el saliente queda libre y el
   * entrante toma el puesto, de modo que la coordinacion no pasa ni un minuto
   * sin responsable (RF-26, RN-07).</p>
   */
  cambiarResponsable(coordinacionId: number, usuarioId: number): Observable<AsignacionRealizada> {
    return this.usuarios.cambiarResponsable(coordinacionId, usuarioId);
  }

  restablecerPassword(id: number): Observable<PasswordTemporal> {
    return this.usuarios.restablecerPassword(id);
  }

  desbloquear(id: number): Observable<Usuario> {
    return this.usuarios.desbloquear(id);
  }
}
