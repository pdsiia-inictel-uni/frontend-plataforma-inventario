import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { Categoria, CategoriaPeticion } from '../dominio/categoria.model';
import { CategoriasPuerto } from '../dominio/puertos';

/** Adaptador HTTP del puerto de categorias (/api/categorias). */
@Injectable({ providedIn: 'root' })
export class CategoriasHttpAdapter extends CategoriasPuerto {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/categorias`;

  override listar(soloActivas = true): Observable<Categoria[]> {
    const params = new HttpParams().set('soloActivas', String(soloActivas));
    return this.http.get<Categoria[]>(this.url, { params });
  }

  override obtener(id: number): Observable<Categoria> {
    return this.http.get<Categoria>(`${this.url}/${id}`);
  }

  override crear(peticion: CategoriaPeticion): Observable<Categoria> {
    return this.http.post<Categoria>(this.url, peticion);
  }

  override editar(id: number, peticion: CategoriaPeticion): Observable<Categoria> {
    return this.http.put<Categoria>(`${this.url}/${id}`, peticion);
  }

  override cambiarEstado(id: number, activa: boolean): Observable<Categoria> {
    const params = new HttpParams().set('activa', String(activa));
    return this.http.patch<Categoria>(`${this.url}/${id}/estado`, {}, { params });
  }
}
