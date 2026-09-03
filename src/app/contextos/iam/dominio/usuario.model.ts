import { OpcionSelect } from '../../../compartido/dominio/opcion-select.model';

/** Roles del sistema (ERS seccion 2.3). */
export type Rol = 'ADMIN' | 'RESPONSABLE' | 'OPERADOR';

/**
 * Situacion de la cuenta de una persona (RF-22b).
 *
 * <p>Dos estados: la persona trabaja aquí y entra, o dejó la institución y con
 * ella su puesto (RN-34). La <b>suspensión temporal</b> existió hasta la v3.10
 * y se retiró: una ausencia de días —vacaciones, un permiso— no es una decisión
 * sobre el acceso al sistema, y tener dos formas distintas de no entrar obligaba
 * a cada pantalla a explicar cuál era cuál.</p>
 */
export type EstadoCuenta = 'ACTIVA' | 'BAJA';

/** Coordinacion en la que una persona tiene puesto (RF-28d). */
export interface CoordinacionAsignada {
  id: number;
  nombre?: string;
  /** Direccion a la que pertenece, para nombrar el ambito entero (RF-01b). */
  direccionNombre?: string;
}

/**
 * Persona del sistema (RF-16 .. RF-30).
 *
 * <p>Desde la v3.3 el rol puede venir vacio: es alguien registrado a quien
 * todavia no se le ha dado un puesto (RF-16b). Las coordinaciones llegan como
 * lista porque la asignacion es una relacion, pero RN-05 la limita a una:
 * ninguna persona figura en dos inventarios.</p>
 */
export interface Usuario {
  id: number;
  username: string;
  nombres: string;
  primerApellido: string;
  /** RF-16: obligatorio, como el primero: la identidad son los dos. */
  segundoApellido: string;
  nombreCompleto: string;
  dni: string;
  cargo?: string;
  correo: string;
  /** null mientras la persona esta solo registrada, sin puesto (RF-16b). */
  rol: Rol | null;
  rolEtiqueta: string;
  sinAsignar: boolean;
  coordinaciones: CoordinacionAsignada[];
  estado: EstadoCuenta;
  estadoEtiqueta: string;
  debeCambiarPassword: boolean;
  bloqueado: boolean;
  ultimoAcceso?: string;
  fechaCreacion: string;
}

/**
 * Registro previo de una persona (RF-16b).
 *
 * <p>Responde a una sola pregunta: quien es. Ni rol, ni coordinacion, ni
 * contrasena: eso es el puesto, y llega con la asignacion.</p>
 */
export interface UsuarioPeticion {
  username: string;
  nombres: string;
  primerApellido: string;
  segundoApellido: string;
  dni: string;
  cargo?: string | null;
  correo: string;
}

/** Puesto que se le da a una persona ya registrada (RF-28d). */
export interface AsignacionPeticion {
  rol: Rol;
  /** Obligatoria salvo para ADMIN, que no pertenece a ninguna (RN-05). */
  coordinacionId?: number | null;
}

/**
 * Resultado de asignar un puesto (RF-28d).
 *
 * <p>La contrasena solo viene la primera vez, cuando la persona estrena su
 * puesto: es cuando su cuenta empieza a poder usarse. Quien ocupo antes otro
 * puesto conserva la suya.</p>
 *
 * <p>No hay campo de relevo: asignar no sustituye a nadie. Si el puesto de
 * responsable esta ocupado, la operacion se rechaza y el servidor nombra a
 * quien lo ocupa (RF-26).</p>
 */
export interface AsignacionRealizada {
  usuario: Usuario;
  passwordTemporal?: string;
  mensaje: string;
}

/** Contrasena temporal entregada a quien administra la cuenta (RF-06). */
export interface PasswordTemporal {
  usuarioId: number;
  username: string;
  passwordTemporal: string;
  mensaje: string;
}

/**
 * Los equipos que retienen a una persona en su puesto (RN-38).
 *
 * <p>La ficha lo consulta al abrirse para poder <b>advertirlo antes</b>:
 * mientras la persona conserve alguno, dar de baja su cuenta se rechaza, y es
 * mejor decirlo con la lista delante que dejar que lo descubra pulsando el
 * botón (RNF-23, RNF-26).</p>
 */
export interface EquiposACargo {
  usuarioId: number;
  nombreCompleto: string;
  cantidad: number;
  /** false mientras conserve alguno: la baja se rechazaría. */
  puedeDarseDeBaja: boolean;
  equipos: EquipoACargo[];
}

/** Lo justo para reconocer un equipo en el aviso: cuál es y dónde está. */
export interface EquipoACargo {
  id: number;
  nombre: string;
  codigoInventario: string;
  laboratorio?: string;
}

/** Criterios de busqueda de personas (RF-28). */
export interface FiltroUsuarios {
  q?: string;
  rol?: Rol | null;
  coordinacionId?: number | null;
  /** RF-28e: true deja solo a las personas registradas que aun no tienen puesto. */
  sinAsignar?: boolean | null;
  estado?: EstadoCuenta | null;
}

export const ROLES: OpcionSelect<Rol>[] = [
  { valor: 'ADMIN', etiqueta: 'Administrador' },
  { valor: 'RESPONSABLE', etiqueta: 'Responsable' },
  { valor: 'OPERADOR', etiqueta: 'Operador' },
];

/** RN-05: solo el ADMIN queda sin coordinacion. */
export function requiereCoordinacion(rol: Rol): boolean {
  return rol !== 'ADMIN';
}

/**
 * Completa lo que la API omite, para que este modelo diga la verdad.
 *
 * <p>El servidor serializa sin los campos nulos, asi que la persona que
 * todavia no tiene puesto llega <b>sin</b> la propiedad {@code rol} y no con
 * ella puesta a {@code null} (RF-16b). Para TypeScript son la misma cosa
 * —ambas cumplen {@code Rol | null}— pero para el codigo que las compara no:
 * {@code undefined !== null} es cierto, y una comprobacion tan inocente como
 * "¿ya tiene rol?" respondia que si a quien no tenia ninguno.</p>
 *
 * <p>Se normaliza aqui, en el borde por donde entran los datos, y no en cada
 * pantalla que los mira: son las pantallas las que no deberian tener que saber
 * como serializa el servidor.</p>
 */
export function normalizarUsuario(crudo: Usuario): Usuario {
  return {
    ...crudo,
    rol: crudo.rol ?? null,
    coordinaciones: crudo.coordinaciones ?? [],
  };
}


/** Distintivo del rol: color y texto, nunca solo color (RNF-30). */
export function claseRol(rol: Rol | null): string {
  switch (rol) {
    case 'ADMIN':
      return 'insignia insignia-admin';
    case 'RESPONSABLE':
      return 'insignia insignia-responsable';
    case 'OPERADOR':
      return 'insignia insignia-operador';
    default:
      // RF-16b: registrada, pero todavia sin puesto.
      return 'insignia insignia-neutra';
  }
}

export const ESTADOS_CUENTA: OpcionSelect<EstadoCuenta>[] = [
  { valor: 'ACTIVA', etiqueta: 'Activas' },
  { valor: 'BAJA', etiqueta: 'De baja' },
];

/**
 * Distintivo del estado de la cuenta: color Y texto, nunca solo color
 * (RNF-30, RNF-29).
 */
export function claseEstadoCuenta(estado: EstadoCuenta): string {
  return estado === 'ACTIVA' ? 'insignia insignia-activo' : 'insignia insignia-inactivo';
}

/** RF-07: la cuenta activa es la unica que entra al sistema. */
export function puedeEntrar(usuario: Usuario): boolean {
  return usuario.estado === 'ACTIVA';
}

/**
 * Nombre de la coordinacion de una persona, lista para mostrar (RN-05).
 *
 * <p>Devuelve cadena vacia para el Administrador, que no pertenece a ninguna,
 * y para quien esta registrado sin puesto.</p>
 */
export function coordinacionDe(usuario: Usuario): string {
  const asignada = usuario.coordinaciones?.[0];
  if (!asignada) {
    return '';
  }
  return asignada.nombre ?? `#${asignada.id}`;
}
