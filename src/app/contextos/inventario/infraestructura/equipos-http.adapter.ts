import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { CriterioPagina, Pagina } from '../../../compartido/dominio/pagina.model';
import { Equipo, EquipoPeticion, EquipoResumen, FiltroInventario } from '../dominio/equipo.model';
import { Movimiento } from '../dominio/movimiento.model';
import { EquiposPuerto } from '../dominio/puertos';

/** Adaptador HTTP del puerto de bienes (/api/equipos). */
@Injectable({ providedIn: 'root' })
export class EquiposHttpAdapter extends EquiposPuerto {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/equipos`;

  override listar(filtro: FiltroInventario, criterio: CriterioPagina): Observable<Pagina<EquipoResumen>> {
    const params = this.parametrosFiltro(filtro)
      .set('pagina', String(criterio.pagina ?? 0))
      .set('tamano', String(criterio.tamano ?? 10))
      .set('ordenarPor', criterio.ordenarPor ?? 'nombre')
      .set('descendente', String(criterio.descendente ?? false));

    return this.http.get<Pagina<EquipoResumen>>(this.url, { params });
  }

  override obtener(id: number): Observable<Equipo> {
    return this.http.get<Equipo>(`${this.url}/${id}`);
  }

  override historial(id: number): Observable<Movimiento[]> {
    return this.http.get<Movimiento[]>(`${this.url}/${id}/historial`);
  }

  override crear(peticion: EquipoPeticion): Observable<Equipo> {
    return this.http.post<Equipo>(this.url, peticion);
  }

  override editar(id: number, peticion: EquipoPeticion): Observable<Equipo> {
    return this.http.put<Equipo>(`${this.url}/${id}`, peticion);
  }

  override enviarAMantenimiento(id: number, motivo: string): Observable<Equipo> {
    return this.http.post<Equipo>(`${this.url}/${id}/mantenimiento`, { motivo });
  }

  override devolverAOperativo(id: number, motivo: string): Observable<Equipo> {
    return this.http.post<Equipo>(`${this.url}/${id}/operativo`, { motivo });
  }

  override asignarResponsableDeEquipo(id: number, operadorId: number | null): Observable<Equipo> {
    return this.http.put<Equipo>(`${this.url}/${id}/responsable-equipo`, {
      responsableEquipoId: operadorId,
    });
  }

  override darDeBaja(id: number, motivo: string): Observable<Equipo> {
    return this.http.post<Equipo>(`${this.url}/${id}/baja`, { motivo });
  }

  override reincorporar(id: number, motivo: string): Observable<Equipo> {
    return this.http.post<Equipo>(`${this.url}/${id}/reincorporar`, { motivo });
  }

  override subirFoto(id: number, archivo: File): Observable<Equipo> {
    const datos = new FormData();
    datos.append('archivo', archivo);
    return this.http.post<Equipo>(`${this.url}/${id}/foto`, datos);
  }

  override descargarFoto(ruta: string): Observable<Blob> {
    return this.http.get(ruta, { responseType: 'blob' });
  }

  /** Los mismos parametros los reutiliza el contexto de reportes al exportar. */
  parametrosFiltro(filtro: FiltroInventario): HttpParams {
    let params = new HttpParams();
    if (filtro.q) {
      params = params.set('q', filtro.q);
    }
    // RF-49: solo el Administrador la envia; para el resto la deduce el
    // servidor del token y mandarla ajena responde 403 (RNF-10).
    if (filtro.coordinacionId) {
      params = params.set('coordinacionId', String(filtro.coordinacionId));
    }
    if (filtro.categoriaId) {
      params = params.set('categoriaId', String(filtro.categoriaId));
    }
    if (filtro.laboratorioId) {
      params = params.set('laboratorioId', String(filtro.laboratorioId));
    }
    if (filtro.condicion) {
      params = params.set('condicion', filtro.condicion);
    }
    if (filtro.todas) {
      params = params.set('todas', 'true');
    }
    return params;
  }
}
