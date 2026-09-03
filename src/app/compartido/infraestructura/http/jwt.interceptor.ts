import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';

import { environment } from '../../../../environments/environment';
import { SesionStore } from '../../../contextos/iam/aplicacion/sesion.store';

/**
 * Adjunta el JWT a todas las peticiones dirigidas a la API (RNF-02).
 *
 * <p>Y nada mas: el cliente no declara en que coordinacion trabaja. Cada
 * persona tiene una sola (RN-05) y el servidor la relee de la base en cada
 * peticion, de modo que el ambito de una operacion nunca depende de lo que
 * diga el navegador (RNF-10).</p>
 */
export const jwtInterceptor: HttpInterceptorFn = (peticion, siguiente) => {
  const sesion = inject(SesionStore);
  const esApi = peticion.url.startsWith(environment.apiUrl) || peticion.url.startsWith('/api');
  const esLogin = peticion.url.includes('/auth/login');

  const token = sesion.token;
  if (!esApi || esLogin || !token) {
    return siguiente(peticion);
  }

  return siguiente(peticion.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};
