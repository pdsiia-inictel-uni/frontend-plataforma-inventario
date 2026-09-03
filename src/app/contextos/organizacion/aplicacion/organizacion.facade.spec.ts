import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';

import { Coordinacion } from '../dominio/estructura.model';
import { OrganizacionPuerto } from '../dominio/puertos';
import { OrganizacionFacade } from './organizacion.facade';

/**
 * Memoria de la lista de coordinaciones (RF-28d).
 *
 * <p>La lista se memoriza porque varias pantallas la piden en cada
 * navegacion. Lo que no puede memorizarse es un fallo: hasta la v3.6, una
 * sola peticion rechazada —la que sale mientras el primer ingreso tiene
 * pendiente el cambio de contrasena, cuando el servidor responde 403 a todo lo
 * demas (RF-06)— quedaba guardada para el resto de la sesion, y todas las
 * pantallas que pedian la lista recibian aquel error en silencio. El efecto
 * visible era que no habia coordinaciones a las que asignar a nadie y solo se
 * podia nombrar administradores, que son los unicos que no necesitan una.</p>
 */
describe('Memoria de coordinaciones de OrganizacionFacade', () => {
  const coordinacion = { id: 1, nombre: 'Coordinacion de Redes', activa: true } as Coordinacion;

  /** Puerto de mentira que cuenta las llamadas y decide que devuelve cada una. */
  class PuertoFalso {
    llamadas = 0;
    respuesta: () => Observable<Coordinacion[]> = () => of([coordinacion]);

    listarCoordinaciones(): Observable<Coordinacion[]> {
      this.llamadas++;
      return this.respuesta();
    }
  }

  let puerto: PuertoFalso;
  let facade: OrganizacionFacade;

  beforeEach(() => {
    puerto = new PuertoFalso();
    TestBed.configureTestingModule({
      providers: [OrganizacionFacade, { provide: OrganizacionPuerto, useValue: puerto }],
    });
    facade = TestBed.inject(OrganizacionFacade);
  });

  it('pregunta una sola vez cuando la respuesta llega bien', () => {
    facade.coordinacionesDisponibles().subscribe();
    facade.coordinacionesDisponibles().subscribe();

    expect(puerto.llamadas).toBe(1);
    expect(facade.coordinaciones()).toEqual([coordinacion]);
  });

  it('no memoriza el fallo: la siguiente pantalla vuelve a preguntar', () => {
    puerto.respuesta = () => throwError(() => new Error('403 mientras el cambio esta pendiente'));

    let fallo: unknown = null;
    facade.coordinacionesDisponibles().subscribe({ error: (e) => (fallo = e) });
    expect(fallo).not.toBeNull();

    // El servidor ya responde: la lista tiene que llegar, no repetirse el error.
    puerto.respuesta = () => of([coordinacion]);
    let recibidas: Coordinacion[] = [];
    facade.coordinacionesDisponibles().subscribe((lista) => (recibidas = lista));

    expect(puerto.llamadas).toBe(2);
    expect(recibidas).toEqual([coordinacion]);
  });

  it('recargar descarta lo memorizado y vuelve a preguntar', () => {
    facade.coordinacionesDisponibles().subscribe();
    facade.recargarCoordinaciones().subscribe();

    expect(puerto.llamadas).toBe(2);
  });
});
