import { Observable } from 'rxjs';

import {
  Coordinacion,
  CoordinacionPeticion,
  Direccion,
  DireccionPeticion,
  Estructura,
  Laboratorio,
  LaboratorioPeticion,
  NuevaCoordinacionPeticion,
} from './estructura.model';

/**
 * Puerto del contexto de organizacion.
 *
 * <p>Se declara como clase abstracta para servir a la vez de contrato y de
 * token de inyeccion: la capa de aplicacion depende de esta abstraccion y el
 * modulo raiz decide que adaptador la implementa.</p>
 */
export abstract class OrganizacionPuerto {
  /** Arbol completo de la institucion (RF-09, RF-15). Solo Administrador. */
  abstract estructura(soloActivas: boolean): Observable<Estructura>;

  /**
   * RF-10: las direcciones son las dos de la institucion y se precargan con el
   * esquema. No se crean ni se desactivan desde la aplicacion; solo se leen y
   * se corrigen sus datos.
   */
  abstract listarDirecciones(soloActivas: boolean): Observable<Direccion[]>;
  abstract editarDireccion(id: number, peticion: DireccionPeticion): Observable<Direccion>;

  abstract listarCoordinaciones(direccionId?: number | null, soloActivas?: boolean): Observable<Coordinacion[]>;
  abstract obtenerCoordinacion(id: number): Observable<Coordinacion>;
  abstract crearCoordinacion(peticion: NuevaCoordinacionPeticion): Observable<Coordinacion>;
  abstract editarCoordinacion(id: number, peticion: CoordinacionPeticion): Observable<Coordinacion>;
  abstract cambiarEstadoCoordinacion(id: number, activo: boolean): Observable<Coordinacion>;

  abstract listarLaboratorios(coordinacionId: number, soloActivos?: boolean): Observable<Laboratorio[]>;
  abstract crearLaboratorio(peticion: LaboratorioPeticion): Observable<Laboratorio>;
  abstract editarLaboratorio(id: number, peticion: LaboratorioPeticion): Observable<Laboratorio>;
  abstract cambiarEstadoLaboratorio(id: number, activo: boolean): Observable<Laboratorio>;
}
