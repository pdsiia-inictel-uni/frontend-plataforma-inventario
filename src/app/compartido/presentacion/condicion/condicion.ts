import { Component, Input } from '@angular/core';

import { NombreIcono } from '../icono/icono';

/** Las cuatro condiciones de un bien, mas la alerta de revision pendiente. */
type Clave = 'OPERATIVO' | 'PRESTADO' | 'MANTENIMIENTO' | 'BAJA' | 'REVISION';

interface Aspecto {
  clase: string;
  icono: NombreIcono;
  etiqueta: string;
  /** RNF-29: en el contexto de prestamos, "Operativo" se dice "Disponible". */
  etiquetaPrestamos: string;
}

const ASPECTOS: Record<Clave, Aspecto> = {
  OPERATIVO: {
    clase: 'insignia-disponible',
    icono: 'correcto',
    etiqueta: 'Operativo',
    etiquetaPrestamos: 'Disponible',
  },
  PRESTADO: {
    clase: 'insignia-prestado',
    icono: 'prestamos',
    etiqueta: 'Prestado',
    etiquetaPrestamos: 'Prestado',
  },
  MANTENIMIENTO: {
    clase: 'insignia-mantenimiento',
    icono: 'mantenimiento',
    etiqueta: 'En mantenimiento',
    etiquetaPrestamos: 'En mantenimiento',
  },
  BAJA: {
    clase: 'insignia-baja',
    icono: 'baja',
    etiqueta: 'Dado de baja',
    etiquetaPrestamos: 'Dado de baja',
  },
  REVISION: {
    clase: 'insignia-revision',
    icono: 'alerta',
    etiqueta: 'Revisión pendiente',
    etiquetaPrestamos: 'Revisión pendiente',
  },
};

/**
 * Distintivo de la condicion de un bien (ERS 8.1, RNF-30).
 *
 * <p>Color, texto e icono siempre juntos: quien no distingue los colores
 * sigue leyendo la condicion, y quien usa un lector de pantalla la escucha.</p>
 */
@Component({
  selector: 'app-condicion',
  standalone: false,
  template: `
    <span class="insignia {{ aspecto.clase }}">
      <app-icono [nombre]="aspecto.icono" tamano="sm" />
      <span>{{ enPrestamos ? aspecto.etiquetaPrestamos : aspecto.etiqueta }}</span>
    </span>
  `,
})
export class CondicionBien {
  @Input({ required: true }) condicion!: string;
  /** RNF-29: cambia el vocabulario al del contexto de prestamos. */
  @Input() enPrestamos = false;

  protected get aspecto(): Aspecto {
    return ASPECTOS[(this.condicion as Clave)] ?? ASPECTOS.OPERATIVO;
  }
}

/**
 * Alerta del bien devuelto con dano (RN-19).
 *
 * <p>Se muestra junto a la condicion, no en su lugar: el bien esta operativo
 * y ademas necesita que el Responsable decida si va a mantenimiento.</p>
 */
@Component({
  selector: 'app-revision-pendiente',
  standalone: false,
  template: `
    <span class="insignia insignia-revision" title="Devuelto con observaciones">
      <app-icono nombre="alerta" tamano="sm" />
      <span>Revisión pendiente</span>
    </span>
  `,
})
export class RevisionPendiente {}
