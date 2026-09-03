import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { CriterioPagina, Pagina } from '../../../compartido/dominio/pagina.model';
import { EquipoResumen, FiltroInventario } from '../../inventario/dominio/equipo.model';
import { InventarioFacade } from '../../inventario/aplicacion/inventario.facade';
import {
  DevolucionPeticion,
  FiltroPrestamos,
  Prestamo,
  PrestamoPeticion,
} from '../dominio/prestamo.model';
import { PrestamosPuerto } from '../dominio/puertos';

/**
 * Casos de uso de prestamos y devoluciones (RF-58 .. RF-68).
 */
@Injectable({ providedIn: 'root' })
export class PrestamosFacade {
  private readonly prestamos = inject(PrestamosPuerto);
  private readonly inventario = inject(InventarioFacade);

  buscar(filtro: FiltroPrestamos, criterio: CriterioPagina): Observable<Pagina<Prestamo>> {
    return this.prestamos.listar(filtro, criterio);
  }

  obtener(id: number): Observable<Prestamo> {
    return this.prestamos.obtener(id);
  }

  vencidos(coordinacionId?: number | null): Observable<Prestamo[]> {
    return this.prestamos.vencidos(coordinacionId);
  }

  historialPorBien(equipoId: number): Observable<Prestamo[]> {
    return this.prestamos.historialPorBien(equipoId);
  }

  historialPorPersona(dni: string): Observable<Prestamo[]> {
    return this.prestamos.historialPorPersona(dni);
  }

  registrar(peticion: PrestamoPeticion): Observable<Prestamo> {
    return this.prestamos.registrar(peticion);
  }

  devolver(id: number, peticion: DevolucionPeticion): Observable<Prestamo> {
    return this.prestamos.devolver(id, peticion);
  }

  /**
   * RF-58: bienes que se pueden prestar hoy.
   *
   * <p>Son exactamente los operativos de la coordinacion del usuario, que en
   * el contexto de prestamos se rotulan "Disponible" (RNF-29). El listado se
   * pide al inventario a traves de su fachada, no a su API: el contexto de
   * prestamos no conoce las rutas ajenas.</p>
   */
  bienesDisponibles(texto?: string): Observable<Pagina<EquipoResumen>> {
    const filtro: FiltroInventario = { q: texto, condicion: 'OPERATIVO' };
    return this.inventario.buscar(filtro, { pagina: 0, tamano: 50, ordenarPor: 'nombre' });
  }
}
