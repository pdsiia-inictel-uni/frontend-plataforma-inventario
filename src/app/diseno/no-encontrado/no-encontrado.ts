import { Component, computed, inject } from '@angular/core';

import { environment } from '../../../environments/environment';
import { SesionStore } from '../../contextos/iam/aplicacion/sesion.store';

/**
 * Pagina 404 propia (RNF-34, ERS 8.5).
 *
 * <p>Un unico boton primario devuelve a la pagina principal que corresponde al
 * rol del usuario, o al acceso si no hay sesion. No se ofrecen atajos a
 * secciones que el rol no podria abrir.</p>
 */
@Component({
  selector: 'app-no-encontrado',
  standalone: false,
  template: `
    <div class="pantalla-mensaje">
      <div class="caja-mensaje">
        <div class="codigo-error">404</div>
        <h1>Pagina no encontrada</h1>
        <p class="texto-secundario">
          La direccion que abrio no corresponde a ninguna pantalla del sistema. Puede que el
          enlace sea antiguo o que tenga un error de escritura.
        </p>
        <a class="btn btn-primario" [routerLink]="destino()">{{ textoBoton() }}</a>
        <div class="pie-mensaje">{{ entorno.institucion }} &middot; {{ entorno.nombreSistema }}</div>
      </div>
    </div>
  `,
})
export class NoEncontrado {
  private readonly sesion = inject(SesionStore);

  protected readonly entorno = environment;

  protected readonly destino = computed(() =>
    this.sesion.autenticado() ? this.sesion.rutaInicio() : '/acceso',
  );

  protected readonly textoBoton = computed(() =>
    this.sesion.autenticado() ? 'Volver al inicio' : 'Ir al acceso',
  );
}
