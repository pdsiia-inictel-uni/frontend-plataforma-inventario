import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { CriterioPagina, Pagina } from '../../../compartido/dominio/pagina.model';
import { Categoria } from '../dominio/categoria.model';
import { Equipo, EquipoPeticion, EquipoResumen, FiltroInventario } from '../dominio/equipo.model';
import { Movimiento } from '../dominio/movimiento.model';
import { CategoriasPuerto, EquiposPuerto } from '../dominio/puertos';

/**
 * Casos de uso del inventario vistos desde la interfaz (RF-34 .. RF-57).
 */
@Injectable({ providedIn: 'root' })
export class InventarioFacade {
  private readonly equipos = inject(EquiposPuerto);
  private readonly categorias = inject(CategoriasPuerto);

  buscar(filtro: FiltroInventario, criterio: CriterioPagina): Observable<Pagina<EquipoResumen>> {
    return this.equipos.listar(filtro, criterio);
  }

  obtener(id: number): Observable<Equipo> {
    return this.equipos.obtener(id);
  }

  /** RF-56: la linea de tiempo del bien, en orden cronologico inverso. */
  historial(id: number): Observable<Movimiento[]> {
    return this.equipos.historial(id);
  }

  crear(peticion: EquipoPeticion): Observable<Equipo> {
    return this.equipos.crear(peticion);
  }

  editar(id: number, peticion: EquipoPeticion): Observable<Equipo> {
    return this.equipos.editar(id, peticion);
  }

  enviarAMantenimiento(id: number, motivo: string): Observable<Equipo> {
    return this.equipos.enviarAMantenimiento(id, motivo);
  }

  devolverAOperativo(id: number, motivo: string): Observable<Equipo> {
    return this.equipos.devolverAOperativo(id, motivo);
  }

  /**
   * RF-83: quien tiene el equipo a su cargo.
   *
   * <p>Solo el Responsable la ejecuta, y solo sobre bienes de su coordinacion.
   * Con {@code operadorId} nulo el bien vuelve a su nombre (RN-37).</p>
   */
  asignarResponsableDeEquipo(id: number, operadorId: number | null): Observable<Equipo> {
    return this.equipos.asignarResponsableDeEquipo(id, operadorId);
  }

  darDeBaja(id: number, motivo: string): Observable<Equipo> {
    return this.equipos.darDeBaja(id, motivo);
  }

  reincorporar(id: number, motivo: string): Observable<Equipo> {
    return this.equipos.reincorporar(id, motivo);
  }

  subirFoto(id: number, archivo: File): Observable<Equipo> {
    return this.equipos.subirFoto(id, archivo);
  }

  descargarFoto(ruta: string): Observable<Blob> {
    return this.equipos.descargarFoto(ruta);
  }

  /** Catalogo de categorias para los desplegables del inventario. */
  categoriasDisponibles(soloActivas = true): Observable<Categoria[]> {
    return this.categorias.listar(soloActivas);
  }
}
