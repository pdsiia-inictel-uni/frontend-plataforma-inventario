import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, from, map, switchMap, throwError } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { FiltroInventario } from '../../inventario/dominio/equipo.model';
import { FormatoUsoGenerado, FormatoUsoPeticion } from '../dominio/formato-uso.model';
import { PanelControl } from '../dominio/panel.model';
import {
  ArchivoExportado,
  ExportacionPuerto,
  FormatoExportacion,
  FormatoUsoPuerto,
  PanelPuerto,
} from '../dominio/puertos';

/** Adaptador HTTP del panel de control (/api/reportes/panel). */
@Injectable({ providedIn: 'root' })
export class PanelHttpAdapter extends PanelPuerto {
  private readonly http = inject(HttpClient);

  override resumen(): Observable<PanelControl> {
    return this.http.get<PanelControl>(`${environment.apiUrl}/reportes/panel`);
  }
}

/** Adaptador HTTP de la exportacion del inventario (RF-52). */
@Injectable({ providedIn: 'root' })
export class ExportacionHttpAdapter extends ExportacionPuerto {
  private readonly http = inject(HttpClient);

  override inventario(formato: FormatoExportacion, filtro: FiltroInventario): Observable<ArchivoExportado> {
    let params = new HttpParams();
    if (filtro.q) {
      params = params.set('q', filtro.q);
    }
    // RF-52: el Administrador exporta por coordinacion; el resto, la suya.
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
    params = params.set('todas', String(filtro.todas ?? !filtro.condicion));

    return this.http
      .get(`${environment.apiUrl}/reportes/inventario/${formato}`, { params, responseType: 'blob' })
      .pipe(map((contenido) => ({
        nombre: `inventario-${new Date().toISOString().slice(0, 10)}.${formato}`,
        contenido,
      })));
  }
}

/**
 * Traduce el error de una peticion que esperaba un archivo.
 *
 * <p>Cuando se pide `responseType: 'blob'`, Angular entrega tambien el cuerpo
 * del error en binario, asi que el JSON que el servidor envio —su mensaje y
 * sus errores por campo— llega como un Blob que nadie sabe leer y la pantalla
 * acaba mostrando un texto de respaldo generico. Aqui se lee y se vuelve a
 * lanzar el error con su cuerpo ya interpretado, de modo que `mensajeError`
 * funcione igual que en cualquier otra peticion (RNF-25).</p>
 */
function conErrorLegible<T>(fuente: Observable<T>): Observable<T> {
  return fuente.pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || !(error.error instanceof Blob)) {
        return throwError(() => error);
      }
      return from(error.error.text()).pipe(
        switchMap((texto) => {
          let cuerpo: unknown = texto;
          try {
            cuerpo = JSON.parse(texto);
          } catch {
            // No era JSON: se deja el texto tal cual, que es mejor que un Blob.
          }
          return throwError(
            () =>
              new HttpErrorResponse({
                error: cuerpo,
                status: error.status,
                statusText: error.statusText,
                url: error.url ?? undefined,
              }),
          );
        }),
      );
    }),
  );
}

/**
 * Adaptador HTTP del formato de registro de uso (RF-78).
 *
 * <p>El servidor responde con el PDF ya dibujado. El nombre del archivo se
 * compone aqui, como en la exportacion del inventario: leerlo de la cabecera
 * Content-Disposition obligaria a analizarla y no aporta nada.</p>
 */
@Injectable({ providedIn: 'root' })
export class FormatoUsoHttpAdapter extends FormatoUsoPuerto {
  private readonly http = inject(HttpClient);

  override generar(equipoId: number, datos: FormatoUsoPeticion): Observable<FormatoUsoGenerado> {
    return this.http
      .post(`${environment.apiUrl}/reportes/equipos/${equipoId}/formato-uso`, datos, {
        responseType: 'blob',
      })
      .pipe(
        map((contenido) => ({
          nombre: `registro-uso-${equipoId}-${new Date().toISOString().slice(0, 10)}.pdf`,
          contenido,
        })),
        conErrorLegible,
      );
  }
}
