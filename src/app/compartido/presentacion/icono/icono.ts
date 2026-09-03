import { Component, Input } from '@angular/core';

/** Nombres de icono disponibles en el sistema. */
export type NombreIcono =
  // Navegacion
  | 'panel'
  | 'estructura'
  | 'inventario'
  | 'prestamos'
  | 'categorias'
  | 'responsables'
  | 'operadores'
  | 'equipo-humano'
  | 'reloj'
  | 'perfil'
  | 'menu'
  | 'plegar'
  | 'desplegar'
  | 'salir'
  // Acciones
  | 'ver'
  | 'ver-oculto'
  | 'buscar'
  | 'editar'
  | 'agregar'
  | 'quitar'
  | 'cerrar'
  | 'correcto'
  | 'descargar'
  | 'reiniciar'
  | 'candado'
  | 'llave'
  | 'desbloquear'
  | 'relevo'
  | 'atras'
  | 'adelante'
  | 'foto'
  | 'camara'
  // Condiciones y avisos
  | 'mantenimiento'
  | 'baja'
  | 'restaurar'
  | 'ubicacion'
  | 'alerta'
  | 'informacion'
  | 'calendario'
  | 'costo';

/**
 * Iconografia del sistema en SVG en linea (RNF-07).
 *
 * <p>Los trazos se declaran en esta plantilla y viajan en el bundle de la
 * aplicacion: no hay peticiones a CDN ni fuentes de iconos externas, y al ser
 * marcado estatico no requiere relajar la Content-Security-Policy.</p>
 *
 * <p>El icono nunca comunica por si solo: siempre acompana a un texto, porque
 * el significado no puede depender de la forma ni del color (RNF-30). Por eso
 * se marca {@code aria-hidden}.</p>
 */
@Component({
  selector: 'app-icono',
  standalone: false,
  template: `
    <svg
      class="icono"
      [class.icono-sm]="tamano === 'sm'"
      [class.icono-lg]="tamano === 'lg'"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false">
      @switch (nombre) {
        @case ('panel') {
          <rect x="3" y="3" width="7" height="9" rx="1" />
          <rect x="14" y="3" width="7" height="5" rx="1" />
          <rect x="14" y="12" width="7" height="9" rx="1" />
          <rect x="3" y="16" width="7" height="5" rx="1" />
        }
        @case ('estructura') {
          <rect x="9" y="2.5" width="6" height="4.5" rx="1" />
          <rect x="2.5" y="16.5" width="6" height="4.5" rx="1" />
          <rect x="15.5" y="16.5" width="6" height="4.5" rx="1" />
          <path d="M12 7v4" />
          <path d="M5.5 16.5V12h13v4.5" />
        }
        @case ('inventario') {
          <path d="M3 7l9-4 9 4-9 4-9-4z" />
          <path d="M3 12l9 4 9-4" />
          <path d="M3 17l9 4 9-4" />
        }
        @case ('prestamos') {
          <path d="M4 8h13" />
          <path d="M14 5l3 3-3 3" />
          <path d="M20 16H7" />
          <path d="M10 13l-3 3 3 3" />
        }
        @case ('categorias') {
          <rect x="3" y="4" width="7" height="7" rx="1" />
          <rect x="14" y="4" width="7" height="7" rx="1" />
          <rect x="3" y="15" width="7" height="5" rx="1" />
          <rect x="14" y="15" width="7" height="5" rx="1" />
        }
        @case ('responsables') {
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5.5 20v-1a6.5 6.5 0 0 1 13 0v1" />
          <path d="M17.5 3.2l.9 1.9 2 .3-1.5 1.4.4 2-1.8-1-1.8 1 .4-2L14.6 5.4l2-.3z" />
        }
        @case ('operadores') {
          <path d="M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20" />
          <circle cx="9.5" cy="7" r="3.5" />
          <path d="M21 20v-1.5a4 4 0 0 0-3-3.87" />
          <path d="M16.5 3.6a3.5 3.5 0 0 1 0 6.8" />
        }
        @case ('equipo-humano') {
          <circle cx="8" cy="8" r="3" />
          <circle cx="17" cy="9.5" r="2.5" />
          <path d="M2.5 19v-1a5.5 5.5 0 0 1 11 0v1" />
          <path d="M15 19v-.8a4.2 4.2 0 0 1 6.5-3.5" />
        }
        @case ('reloj') {
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3.5 2" />
        }
        @case ('perfil') {
          <circle cx="12" cy="8" r="4" />
          <path d="M4.5 20v-.8a7.5 7.5 0 0 1 15 0v.8" />
        }
        @case ('menu') {
          <path d="M3 6h18" />
          <path d="M3 12h18" />
          <path d="M3 18h18" />
        }
        <!-- Doble flecha: repliega el menu lateral hacia el borde izquierdo. -->
        @case ('plegar') {
          <path d="M13 6l-6 6 6 6" />
          <path d="M19 6l-6 6 6 6" />
        }
        @case ('desplegar') {
          <path d="M11 6l6 6-6 6" />
          <path d="M5 6l6 6-6 6" />
        }
        @case ('salir') {
          <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
          <path d="M10 8l-4 4 4 4" />
          <path d="M6 12h10" />
        }
        @case ('ver') {
          <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
          <circle cx="12" cy="12" r="2.8" />
        }
        @case ('ver-oculto') {
          <path d="M4 4l16 16" />
          <path d="M9.9 5.9A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3.5 4.3" />
          <path d="M6.6 7.6A17.3 17.3 0 0 0 2.5 12S6 18.5 12 18.5c1.6 0 3-.3 4.2-.9" />
          <path d="M10 10.1a2.8 2.8 0 0 0 3.9 3.9" />
        }
        @case ('buscar') {
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-4.2-4.2" />
        }
        @case ('editar') {
          <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3z" />
          <path d="M13.5 6.5l4 4" />
        }
        @case ('agregar') {
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        }
        @case ('quitar') {
          <path d="M6 6l12 12" />
          <path d="M18 6L6 18" />
        }
        @case ('cerrar') {
          <path d="M6 6l12 12" />
          <path d="M18 6L6 18" />
        }
        @case ('correcto') {
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        }
        @case ('descargar') {
          <path d="M12 4v11" />
          <path d="M7.5 10.5L12 15l4.5-4.5" />
          <path d="M4 19h16" />
        }
        @case ('reiniciar') {
          <path d="M21 12a9 9 0 1 1-3-6.7" />
          <path d="M21 4v5h-5" />
        }
        @case ('candado') {
          <rect x="4.5" y="10.5" width="15" height="9.5" rx="2" />
          <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
          <circle cx="12" cy="15.2" r="1.5" />
        }
        @case ('llave') {
          <circle cx="8" cy="14.5" r="3.5" />
          <path d="M10.6 12L19 3.6" />
          <path d="M16.2 6.4l2.2 2.2" />
          <path d="M18.6 4l2.2 2.2" />
        }
        @case ('desbloquear') {
          <rect x="4" y="11" width="16" height="9" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 7.5-2" />
        }
        @case ('relevo') {
          <path d="M4 8h11" />
          <path d="M12 5l3 3-3 3" />
          <path d="M20 16H9" />
          <path d="M12 13l-3 3 3 3" />
        }
        @case ('atras') {
          <path d="M15 5l-7 7 7 7" />
        }
        @case ('adelante') {
          <path d="M9 5l7 7-7 7" />
        }
        @case ('foto') {
          <path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2.2l1.2-2h8.2l1.2 2h2.2A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5z" />
          <circle cx="12" cy="13" r="3.5" />
        }
        @case ('camara') {
          <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.2-2h6.6L16.5 7h2A1.5 1.5 0 0 1 20 8.5v9A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5z" />
          <circle cx="12" cy="13" r="3" />
          <path d="M12 8.6v1.2M15.1 13h-1.2M12 17.4v-1.2M8.9 13h1.2" />
        }
        @case ('mantenimiento') {
          <path d="M14.5 6.5a4 4 0 0 0 5 5l-8 8a2.5 2.5 0 0 1-3.5-3.5z" />
          <path d="M14.5 6.5L18 3l3 3-3.5 3.5" />
        }
        @case ('baja') {
          <circle cx="12" cy="12" r="9" />
          <path d="M5.6 5.6l12.8 12.8" />
        }
        @case ('restaurar') {
          <path d="M3 12a9 9 0 1 0 3-6.7" />
          <path d="M3 4v5h5" />
        }
        @case ('ubicacion') {
          <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" />
          <circle cx="12" cy="10" r="2.6" />
        }
        @case ('alerta') {
          <path d="M12 3.5L21.5 20h-19z" />
          <path d="M12 10v4.5" />
          <path d="M12 17.4h.01" />
        }
        @case ('informacion') {
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5.5" />
          <path d="M12 7.6h.01" />
        }
        @case ('calendario') {
          <rect x="3.5" y="5" width="17" height="15" rx="2" />
          <path d="M3.5 10h17" />
          <path d="M8 3v4" />
          <path d="M16 3v4" />
        }
        @case ('costo') {
          <circle cx="12" cy="12" r="9" />
          <path d="M14.5 9a2.8 2.8 0 0 0-2.5-1.4c-1.7 0-2.6 1-2.6 2.1 0 2.9 5.2 1.6 5.2 4.5 0 1.2-1 2.2-2.7 2.2A2.9 2.9 0 0 1 9.3 15" />
          <path d="M12 6v12" />
        }
      }
    </svg>
  `,
})
export class Icono {
  @Input({ required: true }) nombre!: NombreIcono;
  @Input() tamano: 'sm' | 'md' | 'lg' = 'md';
}
