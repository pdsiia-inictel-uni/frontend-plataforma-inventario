import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { CriterioPagina, Pagina } from '../../../compartido/dominio/pagina.model';
import {
  CoordinacionDestino,
  Destinatario,
  DevolucionPeticion,
  FiltroPrestamos,
  Prestamo,
  PrestamoPeticion,
} from '../dominio/prestamo.model';
import {
  AbrirUsoExternoPeticion,
  CerrarUsoExternoPeticion,
  UsoExterno,
} from '../dominio/uso-externo.model';
import { PrestamosPuerto } from '../dominio/puertos';

/** Adaptador HTTP del puerto de prestamos (/api/prestamos). */
@Injectable({ providedIn: 'root' })
export class PrestamosHttpAdapter extends PrestamosPuerto {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/prestamos`;
  private readonly usos = `${environment.apiUrl}/usos-externos`;

  override listar(filtro: FiltroPrestamos, criterio: CriterioPagina): Observable<Pagina<Prestamo>> {
    let params = new HttpParams()
      .set('pagina', String(criterio.pagina ?? 0))
      .set('tamano', String(criterio.tamano ?? 10))
      .set('ordenarPor', criterio.ordenarPor ?? 'fechaPrestamo')
      .set('descendente', String(criterio.descendente ?? true));

    if (filtro.q) {
      params = params.set('q', filtro.q);
    }
    if (filtro.coordinacionId) {
      params = params.set('coordinacionId', String(filtro.coordinacionId));
    }
    if (filtro.estado) {
      params = params.set('estado', filtro.estado);
    }
    if (filtro.equipoId) {
      params = params.set('equipoId', String(filtro.equipoId));
    }
    if (filtro.dni) {
      params = params.set('dni', filtro.dni);
    }
    if (filtro.desde) {
      params = params.set('desde', filtro.desde);
    }
    if (filtro.hasta) {
      params = params.set('hasta', filtro.hasta);
    }
    if (filtro.vencidos) {
      params = params.set('vencidos', 'true');
    }

    return this.http.get<Pagina<Prestamo>>(this.url, { params });
  }

  override obtener(id: number): Observable<Prestamo> {
    return this.http.get<Prestamo>(`${this.url}/${id}`);
  }

  override vencidos(coordinacionId?: number | null): Observable<Prestamo[]> {
    let params = new HttpParams();
    if (coordinacionId) {
      params = params.set('coordinacionId', String(coordinacionId));
    }
    return this.http.get<Prestamo[]>(`${this.url}/vencidos`, { params });
  }

  override historialPorBien(equipoId: number): Observable<Prestamo[]> {
    return this.http.get<Prestamo[]>(`${this.url}/bien/${equipoId}`);
  }

  override historialPorPersona(dni: string): Observable<Prestamo[]> {
    return this.http.get<Prestamo[]>(`${this.url}/persona/${dni}`);
  }

  override registrar(peticion: PrestamoPeticion): Observable<Prestamo> {
    return this.http.post<Prestamo>(this.url, peticion);
  }

  override coordinacionesDestino(): Observable<CoordinacionDestino[]> {
    return this.http.get<CoordinacionDestino[]>(`${this.url}/coordinaciones-destino`);
  }

  override destinatarios(coordinacionId: number): Observable<Destinatario[]> {
    const params = new HttpParams().set('coordinacionId', coordinacionId);
    return this.http.get<Destinatario[]>(`${this.url}/destinatarios`, { params });
  }

  override usosExternos(equipoId: number): Observable<UsoExterno[]> {
    return this.http.get<UsoExterno[]>(`${this.usos}/bien/${equipoId}`);
  }

  override abrirUsoExterno(equipoId: number, peticion: AbrirUsoExternoPeticion): Observable<UsoExterno> {
    return this.http.post<UsoExterno>(`${this.usos}/bien/${equipoId}`, peticion);
  }

  override cerrarUsoExterno(id: number, peticion: CerrarUsoExternoPeticion): Observable<UsoExterno> {
    return this.http.post<UsoExterno>(`${this.usos}/${id}/cierre`, peticion);
  }

  override anularUsoExterno(id: number): Observable<void> {
    return this.http.delete<void>(`${this.usos}/${id}`);
  }

  override devolver(id: number, peticion: DevolucionPeticion): Observable<Prestamo> {
    return this.http.post<Prestamo>(`${this.url}/${id}/devolucion`, peticion);
  }
}
