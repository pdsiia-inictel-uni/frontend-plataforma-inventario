import { Injectable } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, filter, fromEvent, interval, map, merge, share, throttleTime } from 'rxjs';

/**
 * Latido que mantiene al dia lo que se esta mirando.
 *
 * <p>El inventario de una coordinacion lo escriben varias personas a la vez:
 * el responsable da de baja un equipo mientras un operador registra una salida
 * en la pantalla de al lado. Hasta ahora cada pantalla pedia sus datos una sola
 * vez, al abrirse, de modo que la unica manera de ver lo que habia cambiado era
 * recargar el navegador —y para saber que habia que recargarlo, adivinarlo—.
 * Este servicio convierte esa recarga manual en algo que ocurre solo.</p>
 *
 * <p>Emite en dos momentos, que son los dos en que los datos pueden haber
 * envejecido sin que el usuario lo sepa:</p>
 *
 * <ul>
 *   <li>cada {@link INTERVALO_MS}, mientras la pestana esta a la vista;</li>
 *   <li>al volver a ella —{@code focus} o {@code visibilitychange}—, que es
 *       justo cuando el usuario vuelve a mirar y cuando mas viejo esta lo que
 *       hay en pantalla.</li>
 * </ul>
 *
 * <p>Con la pestana oculta no se pide nada: nadie esta leyendo, y sostener una
 * consulta cada medio minuto por cada pestana abierta cuesta al servidor lo
 * mismo que si la leyera alguien (RNF-11).</p>
 *
 * <p>Es un latido, no un canal de eventos: el servidor no avisa de nada, es el
 * cliente quien vuelve a preguntar. Si algun dia hace falta que el cambio se
 * vea en el mismo segundo en que ocurre, el sitio donde ponerlo es este, y las
 * pantallas no tendrian que enterarse.</p>
 */
@Injectable({ providedIn: 'root' })
export class RefrescoAutomatico {
  /** Cada cuanto se vuelve a preguntar, con la pestana a la vista. */
  static readonly INTERVALO_MS = 30_000;

  /** Rafagas de foco seguidas cuentan como una sola vuelta a la pantalla. */
  private static readonly ANTIRREBOTE_MS = 1_000;

  private readonly latido: Observable<void> = merge(
    interval(RefrescoAutomatico.INTERVALO_MS),
    fromEvent(document, 'visibilitychange'),
    fromEvent(window, 'focus'),
  ).pipe(
    filter(() => document.visibilityState === 'visible'),
    throttleTime(RefrescoAutomatico.ANTIRREBOTE_MS),
    map(() => undefined),
    share(),
  );

  /**
   * Ejecuta {@code recargar} cada vez que lo que hay en pantalla puede haber
   * quedado viejo.
   *
   * <p>Debe llamarse desde el constructor del componente: la suscripcion se
   * cancela sola cuando el componente se destruye, de modo que ninguna
   * pantalla sigue preguntando por datos que ya nadie mira.</p>
   *
   * <p>La recarga es <b>silenciosa</b>: no enciende el indicador de carga ni
   * avisa de sus errores. Un giro cada medio minuto sobre una tabla que el
   * usuario esta leyendo, o un aviso rojo porque el servidor tardo en
   * responder a una consulta que nadie pidio, molestan mas de lo que informan
   * (RNF-22). El error que importa —el de la consulta que si pidio el
   * usuario— se sigue mostrando donde siempre.</p>
   */
  alRefrescar(recargar: () => void): void {
    this.latido.pipe(takeUntilDestroyed()).subscribe(recargar);
  }
}
