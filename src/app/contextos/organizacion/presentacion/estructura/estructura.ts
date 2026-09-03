import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { NotificacionStore } from '../../../../compartido/aplicacion/notificacion.store';
import { RefrescoAutomatico } from '../../../../compartido/aplicacion/refresco-automatico';
import {
  erroresDeCampo,
  mensajeError,
} from '../../../../compartido/infraestructura/http/error.interceptor';
import { environment } from '../../../../../environments/environment';
import { UsuariosFacade } from '../../../iam/aplicacion/usuarios.facade';
import { AsignacionRealizada, Usuario } from '../../../iam/dominio/usuario.model';
import { OrganizacionFacade } from '../../aplicacion/organizacion.facade';
import {
  Coordinacion,
  CoordinacionPeticion,
  Direccion,
  DireccionPeticion,
  Estructura,
  Laboratorio,
  LaboratorioPeticion,
  NuevaCoordinacionPeticion,
  RamaDireccion,
} from '../../dominio/estructura.model';

/** Formulario abierto en la ventana modal, si hay alguno. */
type Formulario =
  | { tipo: 'direccion'; direccion: Direccion }
  | { tipo: 'coordinacion'; direccionId: number; coordinacion?: Coordinacion }
  | { tipo: 'laboratorio'; coordinacionId: number; laboratorio?: Laboratorio };

/**
 * Direcciones de la institucion: pagina principal del Administrador
 * (RF-09 .. RF-15).
 *
 * <p>Es su primera tarea al entrar al sistema, porque sin coordinaciones no
 * pueden crearse responsables ni operadores (RN-04).</p>
 *
 * <p>Las dos direcciones de INICTEL-UNI vienen dadas: se precargan con el
 * esquema y no se crean ni se desactivan desde aqui (RF-10). Lo que el
 * Administrador construye son sus coordinaciones y los laboratorios de cada
 * una. Por eso el arbol se pide entero, con las coordinaciones desactivadas
 * incluidas: sin un filtro que las traiga de vuelta, desactivar una seria
 * perderla de vista para siempre.</p>
 *
 * <p>La v3 presenta las coordinaciones como tarjetas en rejilla y no como
 * filas largas: cada coordinacion es una unidad completa —su responsable, su
 * gente, sus laboratorios y sus equipos— y leerla de un vistazo es mas facil
 * en un cuadro que en una linea que cruza toda la pantalla.</p>
 *
 * <p>Dos flujos guiados sostienen las invariantes nuevas: la coordinacion nace
 * con su primer laboratorio (RN-26) y, recien creada, lleva directo a asignar
 * su responsable (RN-07), que es lo unico que le falta para poder operar.</p>
 *
 * <p>Cada cuadro <b>se abre</b> (RF-15b): la rejilla sirve para comparar
 * coordinaciones y el cuadro lleva solo lo que se compara —responsable, tres
 * cifras y estado—; sus laboratorios y sus acciones viven en la ficha, donde
 * se mira una sola y hay sitio para explicarla. Hasta la v3.4 esas acciones se
 * apretaban en el pie del cuadro, seis controles en un espacio pensado para
 * leerse de un vistazo.</p>
 *
 * <p>Aqui vive tambien la <b>baja del responsable</b> (RF-26), y no en la
 * pantalla de personas: lo que hay que ver antes de dejar a alguien sin cargo
 * es la coordinacion que se queda parada, con sus equipos y su gente, y eso es
 * exactamente lo que muestra su ficha. Dado de baja, el ex responsable queda
 * como persona registrada sin coordinacion, y el cuadro pasa a rojo pidiendo
 * un sucesor.</p>
 */
@Component({
  selector: 'app-estructura',
  standalone: false,
  templateUrl: './estructura.html',
})
export class EstructuraOrganizacional {
  private readonly organizacion = inject(OrganizacionFacade);
  /** RF-26: la baja del responsable la ejecuta el contexto de personas. */
  private readonly usuarios = inject(UsuariosFacade);
  private readonly notificaciones = inject(NotificacionStore);
  private readonly refresco = inject(RefrescoAutomatico);
  private readonly router = inject(Router);

  protected readonly entorno = environment;
  protected readonly estructura = signal<Estructura | null>(null);
  protected readonly cargando = signal(true);
  protected readonly guardando = signal(false);

  /**
   * Coordinacion abierta, si hay alguna (RF-15b).
   *
   * <p>La rejilla responde a "cuales hay y cual esta parada"; esta ficha, a
   * "que tiene esta". Dentro caben sus laboratorios, sus cifras y todas sus
   * acciones, que antes se apretaban en el pie de cada cuadro.</p>
   */
  protected readonly detalle = signal<Coordinacion | null>(null);
  /** Laboratorios de la coordinacion abierta; null mientras se cargan. */
  protected readonly laboratorios = signal<Laboratorio[] | null>(null);

  protected readonly formulario = signal<Formulario | null>(null);
  protected readonly errores = signal<Record<string, string>>({});

  /**
   * RF-26b: coordinacion cuyo puesto de Responsable se esta decidiendo.
   *
   * <p>La misma ventana sirve para nombrar al primero y para relevar al que
   * hay: lo que se decide en las dos es lo mismo —quien responde por estos
   * equipos— y los candidatos son los mismos (RN-35).</p>
   */
  protected readonly cambioDeResponsable = signal<Coordinacion | null>(null);
  protected readonly candidatos = signal<Usuario[]>([]);
  protected readonly cargandoCandidatos = signal(false);
  /** Persona elegida, a la espera de la confirmacion (RNF-26). */
  protected readonly confirmandoResponsable = signal<Usuario | null>(null);
  /** RF-06: contrasena recien nacida del puesto, que se muestra una sola vez. */
  protected readonly credencial = signal<AsignacionRealizada | null>(null);
  protected readonly cambioDeCoordinacion = signal<Coordinacion | null>(null);
  protected readonly cambioDeLaboratorio = signal<Laboratorio | null>(null);
  protected readonly procesando = signal(false);

  // Campos del formulario en curso; uno solo esta activo a la vez.
  protected nombre = '';
  protected sigla = '';
  protected descripcion = '';
  protected ubicacion = '';
  /** RN-26: primer laboratorio, obligatorio al crear una coordinacion. */
  protected laboratorioNombre = '';
  protected laboratorioUbicacion = '';

  constructor() {
    this.cargar();

    // Las cifras de cada cuadro —equipos, laboratorios, operadores— y el
    // responsable de cada coordinacion los cambia el trabajo diario de otras
    // personas. Esta es la pantalla de la que el Administrador se fia para
    // saber que unidad esta parada, asi que es la que menos puede envejecer.
    // Con un formulario o una confirmacion abiertos no se recarga: la ficha se
    // rehace debajo y se le movería la decision a quien la esta tomando.
    this.refresco.alRefrescar(() => {
      if (!this.ventanaLibre()) {
        return;
      }
      this.cargar(true);
      const abierta = this.detalle();
      if (abierta) {
        this.cargarLaboratorios(abierta.id, true);
      }
    });
  }

  /**
   * @param silencioso recarga de fondo: sin indicador de carga ni avisos de
   *                   error, para no interrumpir a quien esta leyendo.
   */
  protected cargar(silencioso = false): void {
    if (!silencioso) {
      this.cargando.set(true);
    }
    this.organizacion.estructura(false).subscribe({
      next: (estructura) => {
        this.estructura.set(estructura);
        this.refrescarDetalle(estructura);
        this.cargando.set(false);
      },
      error: (error) => {
        if (!silencioso) {
          this.notificaciones.error(mensajeError(error, 'No se pudo cargar la estructura.'));
        }
        this.cargando.set(false);
      },
    });
  }

  /**
   * La ficha abierta sigue al arbol recien traido.
   *
   * <p>Sin esto, la coordinacion abierta seguiria mostrando el responsable o
   * las cifras que tenia antes de la accion que se acaba de ejecutar sobre
   * ella, que es justo la pantalla donde se comprueba que funciono
   * (RNF-31).</p>
   */
  private refrescarDetalle(estructura: Estructura): void {
    const abierta = this.detalle();
    if (!abierta) {
      return;
    }
    const vigente = estructura.direcciones
      .flatMap((rama) => rama.coordinaciones)
      .find((c) => c.id === abierta.id);
    this.detalle.set(vigente ?? null);
  }

  protected get vacia(): boolean {
    return (this.estructura()?.direcciones.length ?? 0) === 0;
  }

  // ------------------------------------------------- RF-15b: ficha de la coordinacion

  /**
   * Abre la coordinacion.
   *
   * <p>La rejilla existe para comparar unidades de un vistazo, asi que el
   * cuadro solo lleva lo que se compara: su responsable, sus tres cifras y su
   * estado. Todo lo demas —los laboratorios, la edicion, el inventario, el
   * puesto de responsable— vive aqui dentro, donde se mira una sola
   * coordinacion y hay sitio para explicarla.</p>
   */
  protected abrirDetalle(coordinacion: Coordinacion): void {
    this.detalle.set(coordinacion);
    this.laboratorios.set(null);
    this.cargarLaboratorios(coordinacion.id);
  }

  protected cerrarDetalle(): void {
    this.detalle.set(null);
    this.laboratorios.set(null);
  }

  /**
   * No hay ninguna otra ventana encima (RNF-22).
   *
   * <p>La ficha se aparta mientras se llena un formulario o se confirma una
   * accion, y vuelve al cerrarlos con los datos ya recargados. Apilar modales
   * deja al usuario sin saber cual esta atendiendo.</p>
   */
  protected ventanaLibre(): boolean {
    return (
      this.formulario() === null &&
      this.cambioDeResponsable() === null &&
      this.confirmandoResponsable() === null &&
      this.credencial() === null &&
      this.cambioDeCoordinacion() === null &&
      this.cambioDeLaboratorio() === null
    );
  }

  /** Laboratorios activos de la coordinacion abierta (RN-26). */
  protected get laboratoriosActivos(): number {
    return (this.laboratorios() ?? []).filter((lab) => lab.activo).length;
  }

  /**
   * @param silencioso recarga de fondo: un fallo pasajero deja a la vista los
   *                   laboratorios que ya estaban, en lugar de vaciarlos y
   *                   avisar de algo que el usuario no pidio.
   */
  private cargarLaboratorios(coordinacionId: number, silencioso = false): void {
    this.organizacion.listarLaboratorios(coordinacionId, false).subscribe({
      next: (lista) => this.laboratorios.set(lista),
      error: (error) => {
        if (silencioso) {
          return;
        }
        this.notificaciones.error(mensajeError(error, 'No se pudieron cargar los laboratorios.'));
        this.laboratorios.set([]);
      },
    });
  }

  // -------------------------------------------------------------- Formulario

  /** RF-10: la direccion no se crea, solo se corrigen sus datos. */
  protected editarDireccion(direccion: Direccion): void {
    this.limpiar();
    this.nombre = direccion.nombre;
    this.sigla = direccion.sigla ?? '';
    this.descripcion = direccion.descripcion ?? '';
    this.formulario.set({ tipo: 'direccion', direccion });
  }

  protected nuevaCoordinacion(direccionId: number): void {
    this.limpiar();
    this.formulario.set({ tipo: 'coordinacion', direccionId });
  }

  protected editarCoordinacion(coordinacion: Coordinacion): void {
    this.limpiar();
    this.nombre = coordinacion.nombre;
    this.descripcion = coordinacion.descripcion ?? '';
    this.formulario.set({ tipo: 'coordinacion', direccionId: coordinacion.direccionId, coordinacion });
  }

  protected nuevoLaboratorio(coordinacionId: number): void {
    this.limpiar();
    this.formulario.set({ tipo: 'laboratorio', coordinacionId });
  }

  protected editarLaboratorio(laboratorio: Laboratorio): void {
    this.limpiar();
    this.nombre = laboratorio.nombre;
    this.ubicacion = laboratorio.ubicacion ?? '';
    this.formulario.set({
      tipo: 'laboratorio',
      coordinacionId: laboratorio.coordinacionId,
      laboratorio,
    });
  }

  protected cerrarFormulario(): void {
    this.formulario.set(null);
    this.limpiar();
  }

  protected get tituloFormulario(): string {
    const f = this.formulario();
    if (!f) {
      return '';
    }
    switch (f.tipo) {
      case 'direccion':
        return 'Editar dirección';
      case 'coordinacion':
        return f.coordinacion ? 'Editar coordinación' : 'Nueva coordinación';
      default:
        return f.laboratorio ? 'Editar laboratorio' : 'Nuevo laboratorio';
    }
  }

  /** RN-26: el alta de una coordinacion exige tambien su primer laboratorio. */
  protected get formularioCompleto(): boolean {
    const f = this.formulario();
    if (!f || !this.nombre.trim()) {
      return false;
    }
    if (f.tipo === 'coordinacion' && !f.coordinacion) {
      return this.laboratorioNombre.trim().length > 0;
    }
    return true;
  }

  protected guardar(): void {
    const f = this.formulario();
    if (!f || this.guardando() || !this.formularioCompleto) {
      return;
    }
    this.errores.set({});
    this.guardando.set(true);

    const terminar = (mensaje: string) => {
      this.notificaciones.exito(mensaje);
      this.guardando.set(false);
      this.cerrarFormulario();
      this.organizacion.olvidarCoordinaciones();
      this.cargar();
    };
    const fallar = (error: unknown) => {
      this.errores.set(erroresDeCampo(error));
      this.notificaciones.error(mensajeError(error, 'No se pudo guardar.'));
      this.guardando.set(false);
    };

    if (f.tipo === 'direccion') {
      const peticion: DireccionPeticion = {
        nombre: this.nombre.trim(),
        sigla: this.sigla.trim() || null,
        descripcion: this.descripcion.trim() || null,
      };
      this.organizacion.editarDireccion(f.direccion.id, peticion).subscribe({
        next: () => terminar('Dirección actualizada.'),
        error: fallar,
      });
      return;
    }

    if (f.tipo === 'coordinacion') {
      const datos: CoordinacionPeticion = {
        direccionId: f.direccionId,
        nombre: this.nombre.trim(),
        descripcion: this.descripcion.trim() || null,
      };

      if (f.coordinacion) {
        this.organizacion.editarCoordinacion(f.coordinacion.id, datos).subscribe({
          next: () => terminar('Coordinación actualizada.'),
          error: fallar,
        });
        return;
      }

      const peticion: NuevaCoordinacionPeticion = {
        ...datos,
        laboratorioNombre: this.laboratorioNombre.trim(),
        laboratorioUbicacion: this.laboratorioUbicacion.trim() || null,
      };
      this.organizacion.crearCoordinacion(peticion).subscribe({
        // La coordinacion recien creada se queda a la vista, como una tarjeta
        // mas de su direccion. Hasta la v3.2 el alta saltaba sola al asistente
        // de asignacion de responsable: encadenaba dos tareas que no siempre
        // van juntas —a veces la persona todavia no esta decidida— y sacaba al
        // Administrador de la pantalla que acababa de cambiar, sin haberla
        // visto cambiar. La tarjeta nace marcada en rojo y con su boton
        // "Asignar responsable": la tarea pendiente sigue dicha, pero no se
        // impone (RN-07, RNF-31).
        next: (creada) => {
          this.guardando.set(false);
          this.cerrarFormulario();
          this.organizacion.olvidarCoordinaciones();
          this.notificaciones.exito(
            `Coordinacion "${creada.nombre}" creada con su primer laboratorio. Asignele un responsable para que pueda operar.`,
          );
          this.cargar();
        },
        error: fallar,
      });
      return;
    }

    const peticion: LaboratorioPeticion = {
      coordinacionId: f.coordinacionId,
      nombre: this.nombre.trim(),
      ubicacion: this.ubicacion.trim() || null,
    };
    const accion = f.laboratorio
      ? this.organizacion.editarLaboratorio(f.laboratorio.id, peticion)
      : this.organizacion.crearLaboratorio(peticion);
    accion.subscribe({
      next: () => {
        this.cargarLaboratorios(f.coordinacionId);
        terminar(f.laboratorio ? 'Laboratorio actualizado.' : 'Laboratorio creado.');
      },
      error: fallar,
    });
  }

  // --------------------------------------- RF-26b: cambio de responsable

  /**
   * Abre la eleccion de quien responde por esta coordinacion.
   *
   * <p>Sirve igual para nombrar al primero y para relevar al que hay: la
   * pregunta es la misma y los candidatos tambien. La lista se pide al abrir,
   * porque quien puede tomar el puesto cambia con cada alta y con cada
   * relevo.</p>
   */
  protected abrirCambioDeResponsable(coordinacion: Coordinacion): void {
    this.cambioDeResponsable.set(coordinacion);
    this.candidatos.set([]);
    this.cargandoCandidatos.set(true);
    this.usuarios.candidatosAResponsable(coordinacion.id).subscribe({
      next: (lista) => {
        this.candidatos.set(lista);
        this.cargandoCandidatos.set(false);
      },
      error: (error) => {
        this.cargandoCandidatos.set(false);
        this.notificaciones.error(mensajeError(error, 'No se pudo cargar a los candidatos.'));
      },
    });
  }

  protected cerrarCambioDeResponsable(): void {
    this.cambioDeResponsable.set(null);
    this.candidatos.set([]);
  }

  protected pedirCambioDeResponsable(persona: Usuario): void {
    this.confirmandoResponsable.set(persona);
  }

  protected get mensajeCambioResponsable(): string {
    const persona = this.confirmandoResponsable();
    const coordinacion = this.cambioDeResponsable();
    if (!persona || !coordinacion) {
      return '';
    }
    return `${persona.nombreCompleto} pasara a ser responsable de ${coordinacion.nombre}.`;
  }

  /**
   * RNF-26: la consecuencia entera, incluida la que le toca al saliente.
   *
   * <p>Es la parte que no se puede dejar sin decir: el relevo no solo nombra a
   * alguien, tambien deja a otro sin puesto (RF-26).</p>
   */
  protected get detalleCambioResponsable(): string {
    const persona = this.confirmandoResponsable();
    const coordinacion = this.cambioDeResponsable();
    if (!persona || !coordinacion) {
      return '';
    }
    const sobreElEntrante =
      persona.rol === null
        ? 'Estrena puesto, así que el sistema generará su contraseña y se la mostrará una sola vez.'
        : persona.rol === 'ADMIN'
          ? 'Dejará de ser administrador del sistema para hacerse cargo de esta coordinación.'
          : 'Dejará de ser operador para responder por el inventario entero de su coordinación.';
    const sobreElSaliente = coordinacion.responsableId
      ? ` ${coordinacion.responsable} dejara el cargo en el acto y quedara sin puesto, con su cuenta activa y su historial intacto.`
      : '';
    return sobreElEntrante + sobreElSaliente;
  }

  /**
   * RF-26b: ejecuta el relevo.
   *
   * <p>Una sola llamada, una sola transaccion del servidor: el saliente queda
   * libre y el entrante toma el puesto, de modo que la coordinacion no pasa ni
   * un instante sin responsable (RN-07, RN-35).</p>
   */
  protected cambiarResponsable(): void {
    const persona = this.confirmandoResponsable();
    const coordinacion = this.cambioDeResponsable();
    if (!persona || !coordinacion) {
      return;
    }
    this.procesando.set(true);
    this.usuarios.cambiarResponsable(coordinacion.id, persona.id).subscribe({
      next: (realizada) => {
        this.procesando.set(false);
        this.confirmandoResponsable.set(null);
        this.cerrarCambioDeResponsable();
        this.notificaciones.exito(realizada.mensaje);
        if (realizada.passwordTemporal) {
          this.credencial.set(realizada);
        }
        this.organizacion.olvidarCoordinaciones();
        this.cargar();
      },
      error: (error) => {
        this.procesando.set(false);
        this.confirmandoResponsable.set(null);
        this.notificaciones.error(mensajeError(error));
      },
    });
  }

  // ---------------------------------------------------- Activar y desactivar

  protected pedirCambioEstadoCoordinacion(coordinacion: Coordinacion): void {
    this.cambioDeCoordinacion.set(coordinacion);
  }

  protected get mensajeCoordinacion(): string {
    const coordinacion = this.cambioDeCoordinacion();
    if (!coordinacion) {
      return '';
    }
    return coordinacion.activa
      ? `${coordinacion.nombre} dejara de aparecer como coordinacion en funcionamiento.`
      : `${coordinacion.nombre} volvera a estar en funcionamiento.`;
  }

  protected get detalleCoordinacion(): string {
    return this.cambioDeCoordinacion()?.activa
      ? 'Sus equipos, laboratorios y personas se conservan, y podrá volver a activarla cuando lo necesite. Si tiene equipos activos o préstamos vigentes, el sistema lo impedira y le dira por que.'
      : 'Sus equipos y su gente vuelven a estar disponibles tal como quedaron.';
  }

  protected confirmarCambioEstadoCoordinacion(): void {
    const coordinacion = this.cambioDeCoordinacion();
    if (!coordinacion) {
      return;
    }
    this.procesando.set(true);
    this.organizacion.cambiarEstadoCoordinacion(coordinacion.id, !coordinacion.activa).subscribe({
      next: () => {
        this.procesando.set(false);
        this.cambioDeCoordinacion.set(null);
        this.notificaciones.exito(
          coordinacion.activa ? 'Coordinación desactivada.' : 'Coordinación activada.',
        );
        this.organizacion.olvidarCoordinaciones();
        this.cargar();
      },
      // RF-13: el backend explica por que no se puede (bienes o prestamos vivos).
      error: (error) => {
        this.procesando.set(false);
        this.cambioDeCoordinacion.set(null);
        this.notificaciones.error(mensajeError(error));
      },
    });
  }

  protected pedirCambioEstadoLaboratorio(laboratorio: Laboratorio): void {
    this.cambioDeLaboratorio.set(laboratorio);
  }

  protected get mensajeLaboratorio(): string {
    const laboratorio = this.cambioDeLaboratorio();
    if (!laboratorio) {
      return '';
    }
    return laboratorio.activo
      ? `${laboratorio.nombre} dejara de ofrecerse como ubicacion de los equipos.`
      : `${laboratorio.nombre} volvera a ofrecerse como ubicacion de los equipos.`;
  }

  protected get detalleLaboratorio(): string {
    return this.cambioDeLaboratorio()?.activo
      ? 'Toda coordinación conserva al menos un laboratorio activo: si es el último, o si tiene equipos dentro, el sistema lo impedira y le dira por que.'
      : '';
  }

  protected confirmarCambioEstadoLaboratorio(): void {
    const laboratorio = this.cambioDeLaboratorio();
    if (!laboratorio) {
      return;
    }
    this.procesando.set(true);
    this.organizacion.cambiarEstadoLaboratorio(laboratorio.id, !laboratorio.activo).subscribe({
      next: () => {
        this.procesando.set(false);
        this.cambioDeLaboratorio.set(null);
        this.notificaciones.exito(
          laboratorio.activo ? 'Laboratorio desactivado.' : 'Laboratorio activado.',
        );
        this.cargarLaboratorios(laboratorio.coordinacionId);
        this.cargar();
      },
      // RF-14, RN-26: el backend explica si tiene bienes dentro o si es el ultimo.
      error: (error) => {
        this.procesando.set(false);
        this.cambioDeLaboratorio.set(null);
        this.notificaciones.error(mensajeError(error));
      },
    });
  }

  // ------------------------------------------------------------- Navegacion

  protected verInventario(coordinacion: Coordinacion): void {
    void this.router.navigate(['/inventario'], {
      queryParams: { coordinacion: coordinacion.id },
    });
  }

  // El salto a Personas para nombrar responsable ya no hace falta: desde la
  // v3.7 la eleccion ocurre aqui mismo, con la coordinacion delante y la lista
  // de quienes pueden tomarla (RF-26b). La ruta con encargo sigue existiendo y
  // funciona si alguien la tiene guardada, pero ninguna pantalla la genera.

  /** Resumen en linea de la coordinacion (RF-15). */
  protected plural(cantidad: number, singular: string, plural: string): string {
    return `${cantidad} ${cantidad === 1 ? singular : plural}`;
  }

  protected identificarRama(_indice: number, rama: RamaDireccion): number {
    return rama.direccion.id;
  }

  private limpiar(): void {
    this.nombre = '';
    this.sigla = '';
    this.descripcion = '';
    this.ubicacion = '';
    this.laboratorioNombre = '';
    this.laboratorioUbicacion = '';
    this.errores.set({});
  }
}
