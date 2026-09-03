import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';

import { AutenticacionPuerto } from '../dominio/puertos';
import {
  CambioCredencialesPeticion,
  CambioPasswordPeticion,
  LoginPeticion,
  PrimerIngresoPeticion,
  Sesion,
} from '../dominio/sesion.model';
import { CoordinacionAsignada, Rol, Usuario } from '../dominio/usuario.model';

const CLAVE_TOKEN = 'inventario.token';
const CLAVE_USUARIO = 'inventario.usuario';
const CLAVE_EXPIRA = 'inventario.expira';

/**
 * Estado de la sesion del usuario: inicio y cierre, expiracion del token y
 * cambio de las credenciales propias (RF-01 .. RF-06).
 *
 * <p>Capa de aplicacion: coordina el puerto de autenticacion y guarda el
 * estado; no sabe que detras hay HTTP.</p>
 */
@Injectable({ providedIn: 'root' })
export class SesionStore {
  private readonly autenticacion = inject(AutenticacionPuerto);
  private readonly router = inject(Router);

  private readonly _usuario = signal<Usuario | null>(this.leerUsuarioGuardado());

  /** Usuario autenticado, o null si no hay sesion. */
  readonly usuario = this._usuario.asReadonly();
  readonly autenticado = computed(() => this._usuario() !== null && this.token !== null);

  readonly rol = computed<Rol | null>(() => this._usuario()?.rol ?? null);
  readonly esAdmin = computed(() => this.rol() === 'ADMIN');
  readonly esResponsable = computed(() => this.rol() === 'RESPONSABLE');
  readonly esOperador = computed(() => this.rol() === 'OPERADOR');
  /** Responsable y Operador: los dos roles que trabajan dentro del inventario. */
  readonly esOperativo = computed(() => this.esResponsable() || this.esOperador());
  readonly debeCambiarPassword = computed(() => this._usuario()?.debeCambiarPassword === true);

  /**
   * RN-05: coordinacion asignada, si tiene alguna.
   *
   * <p>Es una lista porque la asignacion es una relacion, pero nunca trae mas
   * de un elemento: viene vacia para el Administrador, que no pertenece a
   * ninguna, y para quien esta registrado sin puesto (RF-16b).</p>
   */
  private readonly asignadas = computed<CoordinacionAsignada[]>(
    () => this._usuario()?.coordinaciones ?? [],
  );

  /**
   * Coordinacion en la que se trabaja: la unica que la persona tiene (RN-05).
   *
   * <p>No hay nada que elegir ni que recordar entre recargas. El cliente
   * tampoco la declara al servidor: este la relee de la base en cada peticion,
   * de modo que una baja o una asignacion surten efecto en la siguiente
   * (RNF-10).</p>
   */
  readonly coordinacionId = computed<number | null>(() => this.asignadas()[0]?.id ?? null);

  readonly coordinacion = computed<string | null>(() => this.asignadas()[0]?.nombre ?? null);

  /** Direccion a la que pertenece esa coordinacion (RF-01b). */
  readonly direccion = computed<string | null>(() => this.asignadas()[0]?.direccionNombre ?? null);

  /**
   * RF-01b: hay un ingreso recien hecho que todavia no se ha saludado.
   *
   * <p>Se enciende al autenticarse y lo apaga la pantalla principal cuando el
   * usuario cierra el saludo. Vive en memoria a proposito: recargar la pagina
   * no es entrar, y repetir el saludo en cada F5 lo convertiria en un estorbo
   * en lugar de en una confirmacion de donde se esta trabajando.</p>
   */
  private readonly _recienIngresado = signal(false);
  readonly recienIngresado = this._recienIngresado.asReadonly();

  saludado(): void {
    this._recienIngresado.set(false);
  }

  /**
   * RNF-36: pagina principal segun el rol. El Administrador entra a la
   * estructura organizacional, que es su primera tarea; los demas, a su panel.
   */
  readonly rutaInicio = computed(() => (this.esAdmin() ? '/direcciones' : '/panel'));

  get token(): string | null {
    const token = localStorage.getItem(CLAVE_TOKEN);
    if (!token) {
      return null;
    }
    // RF-03: el token expirado se descarta y obliga a iniciar sesion de nuevo.
    if (this.expirado()) {
      this.limpiar();
      return null;
    }
    return token;
  }

  iniciarSesion(peticion: LoginPeticion): Observable<Sesion> {
    return this.autenticacion.iniciarSesion(peticion).pipe(
      tap((sesion) => {
        this.guardarSesion(sesion);
        // RF-01b: el saludo espera a que el usuario llegue a la aplicacion.
        // Si tiene que cambiar la contrasena, primero la cambia.
        this._recienIngresado.set(true);
      }),
    );
  }

  /** Cambio de la propia contrasena; devuelve una sesion renovada. */
  cambiarPassword(peticion: CambioPasswordPeticion): Observable<Sesion> {
    return this.autenticacion.cambiarPassword(peticion).pipe(tap((sesion) => this.guardarSesion(sesion)));
  }

  /** RF-06b: primer ingreso; confirma la identidad y fija la contrasena. */
  completarPrimerIngreso(peticion: PrimerIngresoPeticion): Observable<Sesion> {
    return this.autenticacion
      .completarPrimerIngreso(peticion)
      .pipe(tap((sesion) => this.guardarSesion(sesion)));
  }

  /** Cambio del propio nombre de usuario y correo institucional. */
  cambiarCredenciales(peticion: CambioCredencialesPeticion): Observable<Sesion> {
    return this.autenticacion.cambiarCredenciales(peticion).pipe(tap((sesion) => this.guardarSesion(sesion)));
  }

  refrescarPerfil(): Observable<Usuario> {
    return this.autenticacion.perfil().pipe(tap((usuario) => this.guardarUsuario(usuario)));
  }

  /** RF-03: cierre de sesion manual. */
  cerrarSesion(motivo?: string): void {
    const habiaSesion = localStorage.getItem(CLAVE_TOKEN) !== null;
    const finalizar = () => {
      this.limpiar();
      void this.router.navigate(['/acceso'], motivo ? { queryParams: { motivo } } : {});
    };
    if (habiaSesion && !this.expirado()) {
      this.autenticacion.cerrarSesion().subscribe({ next: finalizar, error: finalizar });
    } else {
      finalizar();
    }
  }

  /** Cierre inmediato sin llamar a la API (token invalido o expirado). */
  descartar(): void {
    this.limpiar();
  }

  private guardarSesion(sesion: Sesion): void {
    localStorage.setItem(CLAVE_TOKEN, sesion.token);
    localStorage.setItem(CLAVE_EXPIRA, sesion.expiraEn);
    this.guardarUsuario(sesion.usuario);
  }

  private guardarUsuario(usuario: Usuario): void {
    localStorage.setItem(CLAVE_USUARIO, JSON.stringify(usuario));
    this._usuario.set(usuario);
  }

  private limpiar(): void {
    localStorage.removeItem(CLAVE_TOKEN);
    localStorage.removeItem(CLAVE_USUARIO);
    localStorage.removeItem(CLAVE_EXPIRA);
    this._usuario.set(null);
    this._recienIngresado.set(false);
  }

  private expirado(): boolean {
    const expira = localStorage.getItem(CLAVE_EXPIRA);
    if (!expira) {
      return false;
    }
    return new Date(expira).getTime() <= Date.now();
  }

  private leerUsuarioGuardado(): Usuario | null {
    const crudo = localStorage.getItem(CLAVE_USUARIO);
    if (!crudo) {
      return null;
    }
    try {
      return JSON.parse(crudo) as Usuario;
    } catch {
      return null;
    }
  }
}
