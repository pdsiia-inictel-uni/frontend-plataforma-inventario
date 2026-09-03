import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { CriterioPagina, Pagina } from '../../../compartido/dominio/pagina.model';
import { UsuariosPuerto } from '../dominio/puertos';
import {
  AsignacionPeticion,
  AsignacionRealizada,
  EquiposACargo,
  EstadoCuenta,
  FiltroUsuarios,
  PasswordTemporal,
  Usuario,
  UsuarioPeticion,
  normalizarUsuario,
} from '../dominio/usuario.model';

/**
 * Adaptador HTTP del puerto de personas (/api/usuarios).
 *
 * <p>Toda persona que entra por aqui pasa por {@link normalizarUsuario}: el
 * servidor omite los campos nulos, y el modelo del dominio promete un
 * {@code rol} que es {@code Rol} o {@code null}. Cumplir esa promesa es
 * trabajo del adaptador, que es quien conoce el formato de la respuesta.</p>
 */
@Injectable({ providedIn: 'root' })
export class UsuariosHttpAdapter extends UsuariosPuerto {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/usuarios`;

  override listar(filtro: FiltroUsuarios, criterio: CriterioPagina): Observable<Pagina<Usuario>> {
    let params = new HttpParams()
      .set('pagina', String(criterio.pagina ?? 0))
      .set('tamano', String(criterio.tamano ?? 10))
      .set('ordenarPor', criterio.ordenarPor ?? 'primerApellido')
      .set('descendente', String(criterio.descendente ?? false));

    if (filtro.q) {
      params = params.set('q', filtro.q);
    }
    if (filtro.rol) {
      params = params.set('rol', filtro.rol);
    }
    if (filtro.coordinacionId) {
      params = params.set('coordinacionId', String(filtro.coordinacionId));
    }
    if (filtro.sinAsignar !== null && filtro.sinAsignar !== undefined) {
      params = params.set('sinAsignar', String(filtro.sinAsignar));
    }
    if (filtro.estado) {
      params = params.set('estado', filtro.estado);
    }

    return this.http
      .get<Pagina<Usuario>>(this.url, { params })
      .pipe(map((pagina) => ({ ...pagina, contenido: pagina.contenido.map(normalizarUsuario) })));
  }

  override integrantes(coordinacionId: number, soloActivos = false): Observable<Usuario[]> {
    const params = new HttpParams().set('soloActivos', String(soloActivos));
    return this.http
      .get<Usuario[]>(`${this.url}/coordinacion/${coordinacionId}`, { params })
      .pipe(map((lista) => lista.map(normalizarUsuario)));
  }

  override obtener(id: number): Observable<Usuario> {
    return this.http.get<Usuario>(`${this.url}/${id}`).pipe(map(normalizarUsuario));
  }

  override crear(peticion: UsuarioPeticion): Observable<Usuario> {
    return this.http.post<Usuario>(this.url, peticion).pipe(map(normalizarUsuario));
  }

  /** RF-16e: una sola peticion, una sola transaccion en el servidor. */
  override crearConPuesto(
    peticion: UsuarioPeticion,
    puesto: AsignacionPeticion,
  ): Observable<AsignacionRealizada> {
    return this.http
      .post<AsignacionRealizada>(`${this.url}/con-puesto`, { datos: peticion, puesto })
      .pipe(map((hecha) => ({ ...hecha, usuario: normalizarUsuario(hecha.usuario) })));
  }

  override editar(id: number, peticion: UsuarioPeticion): Observable<Usuario> {
    return this.http.put<Usuario>(`${this.url}/${id}`, peticion).pipe(map(normalizarUsuario));
  }

  override asignar(id: number, peticion: AsignacionPeticion): Observable<AsignacionRealizada> {
    return this.http
      .post<AsignacionRealizada>(`${this.url}/${id}/asignaciones`, peticion)
      .pipe(map((hecha) => ({ ...hecha, usuario: normalizarUsuario(hecha.usuario) })));
  }

  override retirar(id: number, coordinacionId: number): Observable<Usuario> {
    return this.http
      .delete<Usuario>(`${this.url}/${id}/asignaciones/${coordinacionId}`)
      .pipe(map(normalizarUsuario));
  }

  /** RN-38: los equipos que impiden dar de baja a esta persona. */
  override equiposACargo(id: number): Observable<EquiposACargo> {
    return this.http.get<EquiposACargo>(`${this.url}/${id}/equipos-a-cargo`);
  }

  override cambiarEstado(id: number, estado: EstadoCuenta): Observable<Usuario> {
    return this.http
      .patch<Usuario>(`${this.url}/${id}/estado`, { estado })
      .pipe(map(normalizarUsuario));
  }

  /** RF-26b: quienes pueden hacerse cargo de esa coordinacion (RN-35). */
  override candidatosAResponsable(coordinacionId: number): Observable<Usuario[]> {
    return this.http
      .get<Usuario[]>(`${this.url}/coordinacion/${coordinacionId}/candidatos-responsable`)
      .pipe(map((lista) => lista.map(normalizarUsuario)));
  }

  /** RF-26b: el relevo entero, en una sola transaccion del servidor. */
  override cambiarResponsable(
    coordinacionId: number,
    usuarioId: number,
  ): Observable<AsignacionRealizada> {
    return this.http
      .post<AsignacionRealizada>(`${this.url}/coordinacion/${coordinacionId}/responsable`, {
        usuarioId,
      })
      .pipe(map((hecha) => ({ ...hecha, usuario: normalizarUsuario(hecha.usuario) })));
  }

  override restablecerPassword(id: number): Observable<PasswordTemporal> {
    return this.http.post<PasswordTemporal>(`${this.url}/${id}/restablecer-password`, {});
  }

  override desbloquear(id: number): Observable<Usuario> {
    return this.http
      .post<Usuario>(`${this.url}/${id}/desbloquear`, {})
      .pipe(map(normalizarUsuario));
  }
}
