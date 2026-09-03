import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { Categoria, CategoriaPeticion } from '../dominio/categoria.model';
import { CategoriasPuerto } from '../dominio/puertos';

/**
 * Casos de uso de categorias de bienes (RF-12, RF-13).
 */
@Injectable({ providedIn: 'root' })
export class CategoriasFacade {
  private readonly categorias = inject(CategoriasPuerto);

  listar(soloActivas = true): Observable<Categoria[]> {
    return this.categorias.listar(soloActivas);
  }

  obtener(id: number): Observable<Categoria> {
    return this.categorias.obtener(id);
  }

  crear(peticion: CategoriaPeticion): Observable<Categoria> {
    return this.categorias.crear(peticion);
  }

  editar(id: number, peticion: CategoriaPeticion): Observable<Categoria> {
    return this.categorias.editar(id, peticion);
  }

  cambiarEstado(id: number, activa: boolean): Observable<Categoria> {
    return this.categorias.cambiarEstado(id, activa);
  }
}
