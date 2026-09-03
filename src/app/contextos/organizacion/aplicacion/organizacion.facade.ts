import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, shareReplay, tap, throwError } from 'rxjs';

import {
  Coordinacion,
  CoordinacionPeticion,
  Direccion,
  DireccionPeticion,
  Estructura,
  Laboratorio,
  LaboratorioPeticion,
  NuevaCoordinacionPeticion,
} from '../dominio/estructura.model';
import { OrganizacionPuerto } from '../dominio/puertos';

/**
 * Casos de uso de la estructura organizacional vistos desde la interfaz
 * (RF-09 .. RF-15).
 *
 * <p>Capa de aplicacion: coordina el puerto y guarda el estado que varias
 * pantallas comparten; no sabe que detras hay HTTP.</p>
 */
@Injectable({ providedIn: 'root' })
export class OrganizacionFacade {
  private readonly organizacion = inject(OrganizacionPuerto);

  /**
   * Coordinaciones ya consultadas.
   *
   * <p>El selector de coordinacion del Administrador aparece en varias
   * pantallas (inventario, prestamos, personas); memorizarlas evita repetir
   * la misma peticion en cada navegacion.</p>
   */
  private readonly _coordinaciones = signal<Coordinacion[]>([]);
  readonly coordinaciones = this._coordinaciones.asReadonly();
  private consulta?: Observable<Coordinacion[]>;

  estructura(soloActivas = false): Observable<Estructura> {
    return this.organizacion.estructura(soloActivas);
  }

  // ------------------------------------------------------------ Direcciones

  listarDirecciones(soloActivas = true): Observable<Direccion[]> {
    return this.organizacion.listarDirecciones(soloActivas);
  }

  editarDireccion(id: number, peticion: DireccionPeticion): Observable<Direccion> {
    return this.organizacion.editarDireccion(id, peticion);
  }

  // ---------------------------------------------------------- Coordinaciones

  /**
   * Coordinaciones que el usuario puede elegir; el backend acota el alcance.
   *
   * <p><b>Solo se memoriza lo que salio bien.</b> `shareReplay` guarda tambien
   * el error, y con `refCount: false` lo guarda para siempre: una sola
   * peticion fallida —la que sale mientras el primer ingreso tiene pendiente
   * el cambio de contrasena, por ejemplo, y el servidor responde 403 a todo lo
   * que no sea cambiarla (RF-06)— dejaba la lista vacia en todas las pantallas
   * durante el resto de la sesion, sin decir nada. Se veia como que no habia
   * coordinaciones a las que asignar a nadie, y solo se dejaba nombrar
   * administradores, que son los que no necesitan ninguna. Ahora el fallo
   * borra la memoria: la siguiente pantalla que la pida vuelve a preguntar.</p>
   */
  coordinacionesDisponibles(): Observable<Coordinacion[]> {
    if (!this.consulta) {
      this.consulta = this.organizacion.listarCoordinaciones(null, true).pipe(
        tap((lista) => this._coordinaciones.set(lista)),
        catchError((error: unknown) => {
          this.olvidarCoordinaciones();
          return throwError(() => error);
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    }
    return this.consulta;
  }

  /**
   * Vuelve a preguntar al servidor, descartando lo memorizado.
   *
   * <p>Lo usa el refresco automatico de las pantallas: quien tiene responsable
   * y quien no, o cuantos equipos hay en cada coordinacion, es justo lo que
   * cambia mientras la lista esta en pantalla, y la memoria de
   * {@link coordinacionesDisponibles} lo dejaria congelado hasta la siguiente
   * escritura propia.</p>
   */
  recargarCoordinaciones(): Observable<Coordinacion[]> {
    this.olvidarCoordinaciones();
    return this.coordinacionesDisponibles();
  }

  obtenerCoordinacion(id: number): Observable<Coordinacion> {
    return this.organizacion.obtenerCoordinacion(id);
  }

  crearCoordinacion(peticion: NuevaCoordinacionPeticion): Observable<Coordinacion> {
    return this.organizacion.crearCoordinacion(peticion).pipe(tap(() => this.olvidarCoordinaciones()));
  }

  editarCoordinacion(id: number, peticion: CoordinacionPeticion): Observable<Coordinacion> {
    return this.organizacion.editarCoordinacion(id, peticion).pipe(tap(() => this.olvidarCoordinaciones()));
  }

  cambiarEstadoCoordinacion(id: number, activo: boolean): Observable<Coordinacion> {
    return this.organizacion.cambiarEstadoCoordinacion(id, activo).pipe(tap(() => this.olvidarCoordinaciones()));
  }

  // ----------------------------------------------------------- Laboratorios

  listarLaboratorios(coordinacionId: number, soloActivos = true): Observable<Laboratorio[]> {
    return this.organizacion.listarLaboratorios(coordinacionId, soloActivos);
  }

  crearLaboratorio(peticion: LaboratorioPeticion): Observable<Laboratorio> {
    return this.organizacion.crearLaboratorio(peticion);
  }

  editarLaboratorio(id: number, peticion: LaboratorioPeticion): Observable<Laboratorio> {
    return this.organizacion.editarLaboratorio(id, peticion);
  }

  cambiarEstadoLaboratorio(id: number, activo: boolean): Observable<Laboratorio> {
    return this.organizacion.cambiarEstadoLaboratorio(id, activo);
  }

  /** Invalida la memoria tras un cambio en la estructura. */
  olvidarCoordinaciones(): void {
    this.consulta = undefined;
    this._coordinaciones.set([]);
  }
}
