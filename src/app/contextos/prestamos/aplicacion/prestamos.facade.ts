import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { CriterioPagina, Pagina } from '../../../compartido/dominio/pagina.model';
import { EquipoResumen, FiltroInventario } from '../../inventario/dominio/equipo.model';
import { InventarioFacade } from '../../inventario/aplicacion/inventario.facade';
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

  /** RF-78: usos externos del equipo, el más reciente primero. */
  usosExternos(equipoId: number): Observable<UsoExterno[]> {
    return this.prestamos.usosExternos(equipoId);
  }

  /** RF-78: primera parte del registro (puntos 1 a 5). El equipo pasa a Prestado. */
  abrirUsoExterno(equipoId: number, peticion: AbrirUsoExternoPeticion): Observable<UsoExterno> {
    return this.prestamos.abrirUsoExterno(equipoId, peticion);
  }

  /** RF-78: parte final (puntos 6 a 10). El equipo vuelve al servicio. */
  cerrarUsoExterno(id: number, peticion: CerrarUsoExternoPeticion): Observable<UsoExterno> {
    return this.prestamos.cerrarUsoExterno(id, peticion);
  }

  /** Anula un uso que solo tiene su primera parte: el equipo no llegó a usarse. */
  anularUsoExterno(id: number): Observable<void> {
    return this.prestamos.anularUsoExterno(id);
  }

  /** RF-59: coordinaciones a las que puede ir un equipo, de cualquier Dirección. */
  coordinacionesDestino(): Observable<CoordinacionDestino[]> {
    return this.prestamos.coordinacionesDestino();
  }

  /** RF-59: a quién puede entregarse un equipo en esa coordinación de destino. */
  destinatarios(coordinacionId: number): Observable<Destinatario[]> {
    return this.prestamos.destinatarios(coordinacionId);
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
