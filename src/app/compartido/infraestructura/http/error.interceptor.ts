import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { NotificacionStore } from '../../aplicacion/notificacion.store';
import { CODIGO_CAMBIO_PASSWORD, RespuestaError } from '../../dominio/respuesta-error.model';
import { SesionStore } from '../../../contextos/iam/aplicacion/sesion.store';

/**
 * Tratamiento uniforme de los errores de la API.
 *
 * - 401: la sesion expiro o el token es invalido; se cierra la sesion (RF-03).
 * - 403 con codigo CAMBIO_PASSWORD_REQUERIDO: se redirige al cambio obligatorio.
 * - El resto se propaga para que cada pantalla lo muestre en contexto.
 */
export const errorInterceptor: HttpInterceptorFn = (peticion, siguiente) => {
  const sesion = inject(SesionStore);
  const router = inject(Router);
  const notificaciones = inject(NotificacionStore);

  return siguiente(peticion).pipe(
    catchError((error: HttpErrorResponse) => {
      const cuerpo = error.error as RespuestaError | null;
      const esLogin = peticion.url.includes('/auth/login');

      if (error.status === 0) {
        notificaciones.error(
          'No se pudo contactar con el servidor. Verifique que el backend este en ejecucion.',
        );
      } else if (error.status === 401 && !esLogin) {
        sesion.descartar();
        void router.navigate(['/acceso'], { queryParams: { motivo: 'expirada' } });
      } else if (error.status === 403 && cuerpo?.codigo === CODIGO_CAMBIO_PASSWORD) {
        void router.navigate(['/cambiar-password']);
      }

      return throwError(() => error);
    }),
  );
};

/** Extrae un mensaje legible en espanol de una respuesta de error. */
export function mensajeError(error: unknown, respaldo = 'Ocurrio un error inesperado.'): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) {
      return 'No se pudo contactar con el servidor.';
    }
    const cuerpo = error.error as RespuestaError | null;
    if (cuerpo?.mensaje) {
      return cuerpo.mensaje;
    }
  }
  return respaldo;
}

/** Devuelve los errores por campo enviados por el backend (RNF-12). */
export function erroresDeCampo(error: unknown): Record<string, string> {
  if (error instanceof HttpErrorResponse) {
    const cuerpo = error.error as RespuestaError | null;
    if (cuerpo?.errores) {
      return cuerpo.errores;
    }
  }
  return {};
}
