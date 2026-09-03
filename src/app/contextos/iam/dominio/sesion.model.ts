import { Usuario } from './usuario.model';

/** Credenciales de inicio de sesion (RF-01). */
export interface LoginPeticion {
  usuario: string;
  password: string;
}

/** Sesion emitida por el backend (RF-02). */
export interface Sesion {
  token: string;
  tipo: string;
  expiraEn: string;
  expiracionMinutos: number;
  debeCambiarPassword: boolean;
  usuario: Usuario;
}

/** Cambio de la propia contrasena (RF-06, RNF-05). */
export interface CambioPasswordPeticion {
  passwordActual: string;
  passwordNueva: string;
  confirmacion: string;
}

/** Cambio del propio nombre de usuario y correo institucional. */
export interface CambioCredencialesPeticion {
  username: string;
  correo: string;
  passwordActual: string;
}

/**
 * Primer ingreso al sistema (RF-06b).
 *
 * <p>Ademas de la contrasena definitiva, el Administrador de la cuenta inicial
 * confirma quien es: esa cuenta nace con nombre y DNI de relleno.</p>
 */
export interface PrimerIngresoPeticion {
  nombres: string;
  primerApellido: string;
  segundoApellido: string;
  dni: string;
  passwordActual: string;
  passwordNueva: string;
  confirmacion: string;
}
