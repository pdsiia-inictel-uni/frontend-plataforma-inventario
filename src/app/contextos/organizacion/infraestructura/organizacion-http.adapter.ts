import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
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

/** Adaptador HTTP del puerto de organizacion (/api/organizacion). */
@Injectable({ providedIn: 'root' })
export class OrganizacionHttpAdapter extends OrganizacionPuerto {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/organizacion`;

  override estructura(): Observable<Estructura> {
    return this.http.get<Estructura>(`${this.url}/estructura`);
  }

  // ------------------------------------------------------------ Direcciones

  override listarDirecciones(): Observable<Direccion[]> {
    return this.http.get<Direccion[]>(`${this.url}/direcciones`);
  }

  override editarDireccion(id: number, peticion: DireccionPeticion): Observable<Direccion> {
    return this.http.put<Direccion>(`${this.url}/direcciones/${id}`, peticion);
  }

  // ---------------------------------------------------------- Coordinaciones

  override listarCoordinaciones(direccionId?: number | null): Observable<Coordinacion[]> {
    let params = new HttpParams();
    if (direccionId) {
      params = params.set('direccionId', String(direccionId));
    }
    return this.http.get<Coordinacion[]>(`${this.url}/coordinaciones`, { params });
  }

  override obtenerCoordinacion(id: number): Observable<Coordinacion> {
    return this.http.get<Coordinacion>(`${this.url}/coordinaciones/${id}`);
  }

  override crearCoordinacion(peticion: NuevaCoordinacionPeticion): Observable<Coordinacion> {
    return this.http.post<Coordinacion>(`${this.url}/coordinaciones`, peticion);
  }

  override editarCoordinacion(id: number, peticion: CoordinacionPeticion): Observable<Coordinacion> {
    return this.http.put<Coordinacion>(`${this.url}/coordinaciones/${id}`, peticion);
  }

  // ----------------------------------------------------------- Laboratorios

  override listarLaboratorios(coordinacionId: number): Observable<Laboratorio[]> {
    return this.http.get<Laboratorio[]>(`${this.url}/coordinaciones/${coordinacionId}/laboratorios`);
  }

  override crearLaboratorio(peticion: LaboratorioPeticion): Observable<Laboratorio> {
    return this.http.post<Laboratorio>(`${this.url}/laboratorios`, peticion);
  }

  override editarLaboratorio(id: number, peticion: LaboratorioPeticion): Observable<Laboratorio> {
    return this.http.put<Laboratorio>(`${this.url}/laboratorios/${id}`, peticion);
  }
}
