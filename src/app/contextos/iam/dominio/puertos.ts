import { Observable } from 'rxjs';

import { CriterioPagina, Pagina } from '../../../compartido/dominio/pagina.model';
import {
  CambioCredencialesPeticion,
  CambioPasswordPeticion,
  LoginPeticion,
  PrimerIngresoPeticion,
  Sesion,
} from './sesion.model';
import {
  AsignacionPeticion,
  AsignacionRealizada,
  EquiposACargo,
  EstadoCuenta,
  FiltroUsuarios,
  PasswordTemporal,
  Usuario,
  UsuarioPeticion,
} from './usuario.model';

/**
 * Puertos del contexto de identidad y acceso.
 *
 * <p>Se declaran como clases abstractas para servir a la vez de contrato y de
 * token de inyeccion: la capa de aplicacion depende de estas abstracciones y el
 * modulo raiz decide que adaptador HTTP las implementa.</p>
 */
export abstract class AutenticacionPuerto {
  abstract iniciarSesion(peticion: LoginPeticion): Observable<Sesion>;
  abstract cerrarSesion(): Observable<unknown>;
  abstract perfil(): Observable<Usuario>;
  abstract cambiarPassword(peticion: CambioPasswordPeticion): Observable<Sesion>;
  /** RF-06b: datos personales propios y contrasena definitiva, en un solo acto. */
  abstract completarPrimerIngreso(peticion: PrimerIngresoPeticion): Observable<Sesion>;
  abstract cambiarCredenciales(peticion: CambioCredencialesPeticion): Observable<Sesion>;
}

export abstract class UsuariosPuerto {
  abstract listar(filtro: FiltroUsuarios, criterio: CriterioPagina): Observable<Pagina<Usuario>>;
  /** Integrantes de una coordinacion: su responsable y sus operadores (RF-29). */
  abstract integrantes(coordinacionId: number, soloActivos: boolean): Observable<Usuario[]>;
  abstract obtener(id: number): Observable<Usuario>;
  /**
   * RN-38: los equipos que impiden dar de baja a esta persona.
   *
   * <p>La ficha lo consulta al abrirse para desactivar el botón y decir por
   * qué, en vez de dejar que el usuario lo pulse y reciba un error que ya se
   * sabía (RNF-23).</p>
   */
  abstract equiposACargo(id: number): Observable<EquiposACargo>;
  /** RF-16b: registro previo, sin rol ni coordinacion ni credenciales. */
  abstract crear(peticion: UsuarioPeticion): Observable<Usuario>;
  /**
   * RF-16e: registro y puesto en una sola peticion y una sola transaccion.
   *
   * <p>El servidor los resuelve juntos: o la persona queda registrada con su
   * puesto y su contrasena, o no queda nada. Encadenar las dos peticiones
   * desde el cliente dejaba, cuando fallaba la segunda, una persona sin puesto
   * que su propio Responsable no podia ver ni volver a registrar.</p>
   */
  abstract crearConPuesto(
    peticion: UsuarioPeticion,
    puesto: AsignacionPeticion,
  ): Observable<AsignacionRealizada>;
  abstract editar(id: number, peticion: UsuarioPeticion): Observable<Usuario>;
  /** RF-28d: le da a la persona su puesto y, con el, su contrasena. */
  abstract asignar(id: number, peticion: AsignacionPeticion): Observable<AsignacionRealizada>;
  /** RF-28d: la retira de una coordinacion, sin desactivar su cuenta. */
  abstract retirar(id: number, coordinacionId: number): Observable<Usuario>;
  /** RF-22b: da de baja la cuenta, o reincorpora a quien lo estaba. */
  abstract cambiarEstado(id: number, estado: EstadoCuenta): Observable<Usuario>;

  /** RF-26b: quienes pueden hacerse cargo de una coordinacion (RN-35). */
  abstract candidatosAResponsable(coordinacionId: number): Observable<Usuario[]>;

  /** RF-26b: pone a otra persona al frente de la coordinacion. */
  abstract cambiarResponsable(coordinacionId: number, usuarioId: number): Observable<AsignacionRealizada>;
  abstract restablecerPassword(id: number): Observable<PasswordTemporal>;
  abstract desbloquear(id: number): Observable<Usuario>;
}
