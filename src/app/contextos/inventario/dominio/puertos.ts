import { Observable } from 'rxjs';

import { CriterioPagina, Pagina } from '../../../compartido/dominio/pagina.model';
import { Categoria, CategoriaPeticion } from './categoria.model';
import { Equipo, EquipoPeticion, EquipoResumen, FiltroInventario } from './equipo.model';
import { Movimiento } from './movimiento.model';

/** Puertos del contexto de inventario. */
export abstract class EquiposPuerto {
  abstract listar(filtro: FiltroInventario, criterio: CriterioPagina): Observable<Pagina<EquipoResumen>>;
  abstract obtener(id: number): Observable<Equipo>;
  /** RF-56: linea de tiempo completa del bien, del alta al ultimo movimiento. */
  abstract historial(id: number): Observable<Movimiento[]>;
  abstract crear(peticion: EquipoPeticion): Observable<Equipo>;
  abstract editar(id: number, peticion: EquipoPeticion): Observable<Equipo>;
  /** RF-41: envio a mantenimiento y retorno a condicion operativa. */
  abstract enviarAMantenimiento(id: number, motivo: string): Observable<Equipo>;
  abstract devolverAOperativo(id: number, motivo: string): Observable<Equipo>;
  /** RF-42, RF-43: baja logica y reincorporacion, ambas con motivo. */
  /**
   * RF-83: pone el bien a cargo de un operador de la coordinacion.
   *
   * <p>Con {@code operadorId} nulo el bien vuelve a cargo del Responsable,
   * que es lo que la pantalla ofrece como "queda a mi nombre".</p>
   */
  abstract asignarResponsableDeEquipo(id: number, operadorId: number | null): Observable<Equipo>;
  abstract darDeBaja(id: number, motivo: string): Observable<Equipo>;
  abstract reincorporar(id: number, motivo: string): Observable<Equipo>;
  abstract subirFoto(id: number, archivo: File): Observable<Equipo>;
  /** Descarga una imagen protegida por JWT para mostrarla como blob (RF-51). */
  abstract descargarFoto(ruta: string): Observable<Blob>;
}

export abstract class CategoriasPuerto {
  abstract listar(soloActivas: boolean): Observable<Categoria[]>;
  abstract obtener(id: number): Observable<Categoria>;
  abstract crear(peticion: CategoriaPeticion): Observable<Categoria>;
  abstract editar(id: number, peticion: CategoriaPeticion): Observable<Categoria>;
  abstract cambiarEstado(id: number, activa: boolean): Observable<Categoria>;
}
