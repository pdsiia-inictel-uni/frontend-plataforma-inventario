import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { AutenticacionPuerto } from '../dominio/puertos';
import {
  CambioCredencialesPeticion,
  CambioPasswordPeticion,
  LoginPeticion,
  PrimerIngresoPeticion,
  Sesion,
} from '../dominio/sesion.model';
import { Usuario, normalizarUsuario } from '../dominio/usuario.model';

/**
 * Adaptador HTTP del puerto de autenticacion (/api/auth).
 *
 * <p>La persona de la sesion pasa por {@link normalizarUsuario}, igual que la
 * de la lista: la API omite los campos nulos, y quien entra sin puesto llega
 * sin la propiedad {@code rol}. El armazon decide con ella que menu enseña.</p>
 */
@Injectable({ providedIn: 'root' })
export class AutenticacionHttpAdapter extends AutenticacionPuerto {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/auth`;

  override iniciarSesion(peticion: LoginPeticion): Observable<Sesion> {
    return this.http.post<Sesion>(`${this.url}/login`, peticion).pipe(map(conUsuarioNormalizado));
  }

  override cerrarSesion(): Observable<unknown> {
    return this.http.post(`${this.url}/logout`, {});
  }

  override perfil(): Observable<Usuario> {
    return this.http.get<Usuario>(`${this.url}/me`).pipe(map(normalizarUsuario));
  }

  override cambiarPassword(peticion: CambioPasswordPeticion): Observable<Sesion> {
    return this.http
      .post<Sesion>(`${this.url}/cambiar-password`, peticion)
      .pipe(map(conUsuarioNormalizado));
  }

  override completarPrimerIngreso(peticion: PrimerIngresoPeticion): Observable<Sesion> {
    return this.http
      .post<Sesion>(`${this.url}/primer-ingreso`, peticion)
      .pipe(map(conUsuarioNormalizado));
  }

  override cambiarCredenciales(peticion: CambioCredencialesPeticion): Observable<Sesion> {
    return this.http.put<Sesion>(`${this.url}/mi-usuario`, peticion).pipe(map(conUsuarioNormalizado));
  }
}

/** La sesion con su persona ya completa. */
function conUsuarioNormalizado(sesion: Sesion): Sesion {
  return { ...sesion, usuario: normalizarUsuario(sesion.usuario) };
}
