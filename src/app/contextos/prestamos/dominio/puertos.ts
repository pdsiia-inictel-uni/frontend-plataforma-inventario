import { Observable } from 'rxjs';

import { CriterioPagina, Pagina } from '../../../compartido/dominio/pagina.model';
import {
  DevolucionPeticion,
  FiltroPrestamos,
  Prestamo,
  PrestamoPeticion,
} from './prestamo.model';

/** Puerto del contexto de prestamos. */
export abstract class PrestamosPuerto {
  abstract listar(filtro: FiltroPrestamos, criterio: CriterioPagina): Observable<Pagina<Prestamo>>;
  abstract obtener(id: number): Observable<Prestamo>;
  /** RF-67: prestamos que superaron la fecha comprometida de devolucion. */
  abstract vencidos(coordinacionId?: number | null): Observable<Prestamo[]>;
  /** RF-66: historial por bien y por persona, dentro del alcance del usuario. */
  abstract historialPorBien(equipoId: number): Observable<Prestamo[]>;
  abstract historialPorPersona(dni: string): Observable<Prestamo[]>;
  abstract registrar(peticion: PrestamoPeticion): Observable<Prestamo>;
  abstract devolver(id: number, peticion: DevolucionPeticion): Observable<Prestamo>;
}
