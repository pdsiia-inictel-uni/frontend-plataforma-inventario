import { Observable } from 'rxjs';

import { CriterioPagina, Pagina } from '../../../compartido/dominio/pagina.model';
import {
  CoordinacionDestino,
  Destinatario,
  DevolucionPeticion,
  FiltroPrestamos,
  Prestamo,
  PrestamoPeticion,
} from './prestamo.model';
import {
  AbrirUsoExternoPeticion,
  CerrarUsoExternoPeticion,
  UsoExterno,
} from './uso-externo.model';

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
  /** RF-59: coordinaciones de destino, de todas las Direcciones. */
  abstract coordinacionesDestino(): Observable<CoordinacionDestino[]>;
  /** RF-59: Responsable y Operadores activos de la coordinación de destino. */
  abstract destinatarios(coordinacionId: number): Observable<Destinatario[]>;
  /** RF-78: usos externos del equipo y sus dos partes. */
  abstract usosExternos(equipoId: number): Observable<UsoExterno[]>;
  abstract abrirUsoExterno(equipoId: number, peticion: AbrirUsoExternoPeticion): Observable<UsoExterno>;
  abstract cerrarUsoExterno(id: number, peticion: CerrarUsoExternoPeticion): Observable<UsoExterno>;
  /** Anula un uso con solo su primera parte: se borra y el equipo vuelve a Operativo. */
  abstract anularUsoExterno(id: number): Observable<void>;
  abstract devolver(id: number, peticion: DevolucionPeticion): Observable<Prestamo>;
}
