import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

import { environment } from '../../../environments/environment';
import { RefrescoAutomatico } from '../../compartido/aplicacion/refresco-automatico';
import { NombreIcono } from '../../compartido/presentacion/icono/icono';
import { SesionStore } from '../../contextos/iam/aplicacion/sesion.store';
import { Rol } from '../../contextos/iam/dominio/usuario.model';

interface EnlaceMenu {
  ruta: string;
  etiqueta: string;
  icono: NombreIcono;
  grupo: string;
  roles: Rol[];
}

/**
 * Armazon de la aplicacion: menu lateral, barra superior y area de contenido.
 *
 * <p>RNF-23: cada usuario ve unicamente las opciones que su rol puede ejercer.
 * No se muestran opciones deshabilitadas ni menus que terminen en un error de
 * permisos, de modo que el menu es tambien la documentacion de lo que se
 * puede hacer.</p>
 */
@Component({
  selector: 'app-principal',
  standalone: false,
  templateUrl: './principal.html',
})
export class Principal {
  /** Preferencia de visibilidad del menu, recordada entre sesiones. */
  private static readonly CLAVE_MENU_OCULTO = 'inventario.menu-oculto';

  private readonly sesion = inject(SesionStore);
  private readonly refresco = inject(RefrescoAutomatico);
  private readonly router = inject(Router);

  protected readonly entorno = environment;
  protected readonly usuario = this.sesion.usuario;

  /** Cajon del menu en pantallas estrechas: se abre sobre el contenido. */
  protected readonly menuAbierto = signal(false);

  /**
   * Menu replegado en pantallas anchas, para ver el contenido a pantalla
   * completa. Es distinto de {@link menuAbierto}: aquel es el cajon del movil,
   * este es una preferencia del usuario que persiste entre sesiones.
   */
  protected readonly menuOculto = signal(Principal.leerPreferencia());

  protected readonly tituloPagina = signal('Inventario');

  /**
   * ERS 8.1: el encabezado indica siempre el ambito de trabajo. El usuario
   * operativo trabaja dentro de su coordinacion; el Administrador, sobre toda
   * la institucion.
   */
  protected readonly ambito = computed(() => this.sesion.coordinacion() ?? this.entorno.institucion);

  /**
   * RF-01b: saludo de bienvenida, una vez por ingreso.
   *
   * <p>Dice a quien entra donde acaba de entrar: su coordinacion y la
   * direccion a la que pertenece. Es la primera vez que el sistema puede
   * decirselo —antes del acceso no sabe quien es— y es exactamente lo que
   * necesita saber quien trabaja en una sola coordinacion: que esta parado
   * donde cree (ERS 8.1).</p>
   */
  protected readonly bienvenida = this.sesion.recienIngresado;
  protected readonly nombreUsuario = computed(() => this.sesion.usuario()?.nombreCompleto ?? '');
  protected readonly rolUsuario = computed(() => this.sesion.usuario()?.rolEtiqueta ?? '');
  protected readonly coordinacionUsuario = this.sesion.coordinacion;
  protected readonly direccionUsuario = this.sesion.direccion;
  protected readonly esAdmin = this.sesion.esAdmin;
  /** Quien no tiene coordinacion y no es Administrador aun no tiene puesto. */
  protected readonly sinPuesto = computed(
    () => !this.sesion.esAdmin() && this.sesion.coordinacionId() === null,
  );

  protected cerrarBienvenida(): void {
    this.sesion.saludado();
  }

  /**
   * Menu del sistema, en el orden en que debe leerse.
   *
   * <p>Los grupos aparecen en el orden en que se declara su primer enlace, asi
   * que el orden de esta lista es el de la pantalla. Para el Administrador
   * empieza por la estructura, que es su primera tarea (ERS 8.2); para los
   * roles operativos, por su inicio (ERS 8.3, 8.4).</p>
   */
  private readonly enlaces: EnlaceMenu[] = [
    // Inicio de los roles operativos
    { ruta: '/panel', etiqueta: 'Inicio', icono: 'panel', grupo: 'Operación', roles: ['RESPONSABLE', 'OPERADOR'] },

    // Institucion (solo Administrador).
    //
    // El catalogo de categorias no esta aqui: se administra desde el
    // inventario, que es donde se usa y donde se echa en falta (RF-31).
    { ruta: '/direcciones', etiqueta: 'Direcciones', icono: 'estructura', grupo: 'Institución', roles: ['ADMIN'] },

    // Personas: una sola entrada para los tres roles, con filtro por rol
    // dentro (RF-28). Separarlas obligaba a saber de antemano que rol tenia
    // la persona que se buscaba.
    // Personas viaja con Direcciones: repartir puestos es organizar la
    // institucion, igual que crear una coordinacion. Asi el Administrador pasa
    // de cinco rotulos de grupo para cinco entradas —un rotulo por entrada, que
    // no agrupa nada— a tres que si dicen algo.
    { ruta: '/personas', etiqueta: 'Personas', icono: 'responsables', grupo: 'Institución', roles: ['ADMIN'] },
    { ruta: '/mi-equipo', etiqueta: 'Mi equipo humano', icono: 'equipo-humano', grupo: 'Personas', roles: ['RESPONSABLE'] },

    // Operacion
    // Las mismas dos pantallas, con el rotulo que corresponde a lo que cada rol
    // puede hacer en ellas: el Administrador solo consulta (RF-46, RF-68,
    // RN-22); el Responsable y el Operador trabajan.
    { ruta: '/inventario', etiqueta: 'Inventario', icono: 'inventario', grupo: 'Consulta', roles: ['ADMIN'] },
    { ruta: '/prestamos', etiqueta: 'Préstamos', icono: 'prestamos', grupo: 'Consulta', roles: ['ADMIN'] },
    { ruta: '/inventario', etiqueta: 'Inventario', icono: 'inventario', grupo: 'Operación', roles: ['RESPONSABLE', 'OPERADOR'] },
    { ruta: '/prestamos', etiqueta: 'Préstamos', icono: 'prestamos', grupo: 'Operación', roles: ['RESPONSABLE', 'OPERADOR'] },

    // El panel institucional cierra el menu del Administrador: es un resumen,
    // no su punto de partida.
    { ruta: '/panel', etiqueta: 'Panel', icono: 'panel', grupo: 'Consulta', roles: ['ADMIN'] },

    { ruta: '/cuenta', etiqueta: 'Mi cuenta', icono: 'perfil', grupo: 'Cuenta', roles: ['ADMIN', 'RESPONSABLE', 'OPERADOR'] },
  ];

  /**
   * Pantallas que no son una entrada del menu pero necesitan titulo propio en
   * la barra superior: se llega a ellas desde otra pantalla.
   */
  private readonly titulosFueraDelMenu: { ruta: string; etiqueta: string }[] = [
    { ruta: '/categorias', etiqueta: 'Categorias' },
  ];

  /** Menu del rol en curso, agrupado y en el orden en que se declaro. */
  protected readonly grupos = computed(() => {
    const rol = this.sesion.rol();
    if (!rol) {
      return [];
    }
    const visibles = this.enlaces.filter((e) => e.roles.includes(rol));
    const nombres = [...new Set(visibles.map((e) => e.grupo))];
    return nombres.map((nombre) => ({
      nombre,
      enlaces: visibles.filter((e) => e.grupo === nombre),
    }));
  });

  constructor() {
    this.actualizarTitulo(this.router.url);
    this.router.events
      .pipe(filter((evento): evento is NavigationEnd => evento instanceof NavigationEnd))
      .subscribe((evento) => {
        this.actualizarTitulo(evento.urlAfterRedirects);
        this.menuAbierto.set(false);
      });

    // El puesto de una persona lo cambia el Administrador desde su pantalla, y
    // de el dependen el menu, el ambito del encabezado y lo que cada pantalla
    // puede hacer (RF-02, RNF-10). El servidor ya relee el rol y la
    // coordinacion en cada peticion; el armazon hace lo propio, para que una
    // asignacion o una baja no esperen a que el usuario cierre la sesion.
    this.refresco.alRefrescar(() =>
      this.sesion.refrescarPerfil().subscribe({
        // Un fallo pasajero no cambia nada: sigue valiendo el perfil que ya
        // hay. La sesion caducada la trata el interceptor, que cierra sesion.
        error: () => undefined,
      }),
    );
  }

  /** Cierra el menu lateral con la tecla Escape (RNF-32). */
  @HostListener('document:keydown.escape')
  protected alPresionarEscape(): void {
    if (this.menuAbierto()) {
      this.menuAbierto.set(false);
    }
  }

  protected get iniciales(): string {
    const u = this.usuario();
    if (!u) {
      return '?';
    }
    return `${u.nombres.charAt(0)}${u.primerApellido.charAt(0)}`.toUpperCase();
  }

  protected alternarMenu(): void {
    this.menuAbierto.update((abierto) => !abierto);
  }

  /** Repliega o despliega el menu lateral y recuerda la eleccion. */
  protected alternarVisibilidadMenu(): void {
    const oculto = !this.menuOculto();
    this.menuOculto.set(oculto);
    try {
      localStorage.setItem(Principal.CLAVE_MENU_OCULTO, oculto ? '1' : '0');
    } catch {
      // Navegacion privada o almacenamiento bloqueado: la preferencia vale
      // para esta sesion y no se recuerda. No es motivo para molestar a nadie.
    }
  }

  private static leerPreferencia(): boolean {
    try {
      return localStorage.getItem(Principal.CLAVE_MENU_OCULTO) === '1';
    } catch {
      return false;
    }
  }

  protected cerrarSesion(): void {
    this.sesion.cerrarSesion('cerrada');
  }

  private actualizarTitulo(url: string): void {
    const rol = this.sesion.rol();
    const candidatos = rol ? this.enlaces.filter((e) => e.roles.includes(rol)) : [];
    // El enlace mas especifico gana: /inventario/nuevo debe titularse como
    // Inventario, no como la primera coincidencia que empiece por barra.
    const coincide = (ruta: string) =>
      url === ruta || url.startsWith(`${ruta}/`) || url.startsWith(`${ruta}?`);
    const coincidencia = candidatos
      .filter((e) => coincide(e.ruta))
      .sort((a, b) => b.ruta.length - a.ruta.length)[0];
    if (coincidencia) {
      this.tituloPagina.set(coincidencia.etiqueta);
      return;
    }
    const fueraDelMenu = this.titulosFueraDelMenu.find((e) => coincide(e.ruta));
    this.tituloPagina.set(fueraDelMenu ? fueraDelMenu.etiqueta : 'Inventario');
  }
}
