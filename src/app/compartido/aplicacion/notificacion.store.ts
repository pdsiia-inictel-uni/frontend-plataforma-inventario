import { Injectable, signal } from '@angular/core';

export type TipoNotificacion = 'info' | 'exito' | 'error' | 'alerta';

export interface Notificacion {
  id: number;
  tipo: TipoNotificacion;
  mensaje: string;
}

/**
 * Estado de los avisos emergentes de la aplicacion (RNF-12).
 */
@Injectable({ providedIn: 'root' })
export class NotificacionStore {
  private contador = 0;
  readonly lista = signal<Notificacion[]>([]);

  exito(mensaje: string): void {
    this.mostrar('exito', mensaje);
  }

  error(mensaje: string): void {
    this.mostrar('error', mensaje, 8000);
  }

  alerta(mensaje: string): void {
    this.mostrar('alerta', mensaje, 7000);
  }

  info(mensaje: string): void {
    this.mostrar('info', mensaje);
  }

  cerrar(id: number): void {
    this.lista.update((actual) => actual.filter((n) => n.id !== id));
  }

  private mostrar(tipo: TipoNotificacion, mensaje: string, duracion = 5000): void {
    const id = ++this.contador;
    this.lista.update((actual) => [...actual, { id, tipo, mensaje }]);
    setTimeout(() => this.cerrar(id), duracion);
  }
}
