import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { NotificacionStore } from '../../../compartido/aplicacion/notificacion.store';
import { Rol } from '../dominio/usuario.model';
import { SesionStore } from './sesion.store';

/** Exige sesion activa; ademas desvia al cambio obligatorio si esta pendiente. */
export const sesionGuard: CanActivateFn = (_ruta, estado) => {
  const sesion = inject(SesionStore);
  const router = inject(Router);

  if (!sesion.autenticado()) {
    return router.createUrlTree(['/acceso'], { queryParams: { retorno: estado.url } });
  }
  if (sesion.debeCambiarPassword()) {
    return router.createUrlTree(['/cambiar-password']);
  }
  return true;
};

/**
 * RNF-35: una ruta existente pero no autorizada redirige a la pagina principal
 * del rol con un aviso, sin filtrar si el recurso existe.
 *
 * <p>Es la segunda linea de defensa, no la primera: el menu ya oculta lo que el
 * rol no puede ejercer (RNF-23) y el backend es la unica validacion
 * autoritativa (RF-04). Esta guardia solo cubre la url escrita a mano.</p>
 */
function exigirRol(...permitidos: Rol[]): CanActivateFn {
  return () => {
    const sesion = inject(SesionStore);
    const router = inject(Router);
    const notificaciones = inject(NotificacionStore);

    const rol = sesion.rol();
    if (rol && permitidos.includes(rol)) {
      return true;
    }
    notificaciones.alerta('Esa sección no forma parte de sus funciones.');
    return router.createUrlTree([sesion.rutaInicio()]);
  };
}

/** Estructura, responsables, operadores y categorias (ERS 8.2). */
export const adminGuard: CanActivateFn = exigirRol('ADMIN');

/** Mi equipo humano y edicion de bienes (ERS 8.3). */
export const responsableGuard: CanActivateFn = exigirRol('RESPONSABLE');

/** RN-22: el Administrador no escribe bienes ni prestamos. */
export const operativoGuard: CanActivateFn = exigirRol('RESPONSABLE', 'OPERADOR');

/** Solo accesible con sesion activa y cambio de contrasena pendiente. */
export const cambioPasswordGuard: CanActivateFn = () => {
  const sesion = inject(SesionStore);
  const router = inject(Router);

  if (!sesion.autenticado()) {
    return router.createUrlTree(['/acceso']);
  }
  if (!sesion.debeCambiarPassword()) {
    return router.createUrlTree([sesion.rutaInicio()]);
  }
  return true;
};

/** Evita mostrar la pantalla de acceso a quien ya inicio sesion. */
export const invitadoGuard: CanActivateFn = () => {
  const sesion = inject(SesionStore);
  const router = inject(Router);

  if (sesion.autenticado()) {
    return router.createUrlTree([
      sesion.debeCambiarPassword() ? '/cambiar-password' : sesion.rutaInicio(),
    ]);
  }
  return true;
};
