import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { NotificacionStore } from '../../../../compartido/aplicacion/notificacion.store';
import {
  erroresDeCampo,
  mensajeError,
} from '../../../../compartido/infraestructura/http/error.interceptor';
import { SesionStore } from '../../../iam/aplicacion/sesion.store';
import { OrganizacionFacade } from '../../../organizacion/aplicacion/organizacion.facade';
import { Laboratorio } from '../../../organizacion/dominio/estructura.model';
import { InventarioFacade } from '../../aplicacion/inventario.facade';
import { Categoria } from '../../dominio/categoria.model';
import {
  FECHA_MINIMA_ADQUISICION,
  Equipo,
  EquipoPeticion,
  fechaMaximaAdquisicion,
} from '../../dominio/equipo.model';

/**
 * Registro y edicion de un bien (RF-34, RF-40).
 *
 * <p>El formulario se divide en pasos cortos con progreso visible (RNF-28)
 * porque el Operador es el usuario con menos experiencia informatica del
 * sistema y una pantalla con doce campos lo detiene.</p>
 *
 * <p>La condicion no se pregunta: todo bien nace OPERATIVO y el servidor lo
 * impone (RF-35). Tampoco la coordinacion ni el responsable, que se deducen
 * del token (RF-36, RF-37).</p>
 */
@Component({
  selector: 'app-formulario-bien',
  standalone: false,
  templateUrl: './formulario-bien.html',
})
export class FormularioBien {
  private readonly inventario = inject(InventarioFacade);
  private readonly organizacion = inject(OrganizacionFacade);
  private readonly sesion = inject(SesionStore);
  private readonly notificaciones = inject(NotificacionStore);
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly id = Number(this.ruta.snapshot.paramMap.get('id')) || null;

  /**
   * RF-51c: la fotografia la pone quien puede cambiar el bien.
   *
   * <p>Desde la v3.10 es el <b>Responsable</b>, y solo el: sobre un equipo ya
   * registrado escribe el nada mas, y la fotografia es un dato del bien como
   * cualquier otro (RF-45). El Operador registra el equipo sin ella y el
   * Responsable la adjunta despues desde <em>Editar</em>, que es donde ahora
   * vive —antes vivia en la ficha, y alli la cambiaba cualquiera de los
   * dos—.</p>
   */
  protected readonly puedeFotografiar = this.sesion.esResponsable();

  /**
   * Pasos del asistente (RNF-28).
   *
   * <p>El segundo paso incluye la fotografia solo si quien lo abre puede
   * ponerla: rotular un paso con algo que no va a aparecer es prometer lo que
   * no se cumple (RNF-23).</p>
   */
  protected readonly titulos = this.puedeFotografiar
    ? ['Identificación y códigos', 'Adquisición, ubicación y fotografía', 'Resumen']
    : ['Identificación y códigos', 'Adquisición y ubicación', 'Resumen'];

  /**
   * El resumen es siempre el ultimo, y es el unico paso que no pide nada: solo
   * enseña lo escrito para revisarlo antes de guardar.
   */
  protected readonly indiceResumen = this.titulos.length - 1;

  protected readonly paso = signal(0);

  protected readonly categorias = signal<Categoria[]>([]);
  protected readonly laboratorios = signal<Laboratorio[]>([]);
  protected readonly cargando = signal(false);
  protected readonly guardando = signal(false);
  protected readonly errores = signal<Record<string, string>>({});
  protected readonly original = signal<Equipo | null>(null);

  protected readonly fechaMinima = FECHA_MINIMA_ADQUISICION;
  /** RN-25: hoy. Se calcula al abrir el formulario, no en cada deteccion. */
  protected readonly fechaMaxima = fechaMaximaAdquisicion();

  protected nombre = '';
  protected marca = '';
  protected modelo = '';
  protected categoriaId: number | null = null;
  protected numeroSerie = '';
  protected codigoInventario = '';
  protected codigoPatrimonial = '';
  protected fechaAdquisicion = '';
  protected costo: number | null = null;
  protected laboratorioId: number | null = null;
  protected observaciones = '';

  /** Fotografia opcional elegida en el paso de fotografia (RF-51b). */
  protected readonly foto = signal<File | null>(null);

  protected readonly esEdicion = computed(() => this.id !== null);

  constructor() {
    this.inventario.categoriasDisponibles(true).subscribe({
      next: (lista) => this.categorias.set(lista),
      error: () => this.categorias.set([]),
    });

    const coordinacionId = this.sesion.coordinacionId();
    if (coordinacionId) {
      this.organizacion.listarLaboratorios(coordinacionId, true).subscribe({
        next: (lista) => this.laboratorios.set(lista),
        error: () => this.laboratorios.set([]),
      });
    }

    if (this.id) {
      this.cargarBien(this.id);
    }
  }

  private cargarBien(id: number): void {
    this.cargando.set(true);
    this.inventario.obtener(id).subscribe({
      next: (equipo) => {
        this.original.set(equipo);
        this.nombre = equipo.nombre;
        this.marca = equipo.marca;
        this.modelo = equipo.modelo;
        this.categoriaId = equipo.categoriaId ?? null;
        this.numeroSerie = equipo.numeroSerie;
        this.codigoInventario = equipo.codigoInventario;
        this.codigoPatrimonial = equipo.codigoPatrimonial;
        this.fechaAdquisicion = equipo.fechaAdquisicion;
        this.costo = equipo.costo;
        this.laboratorioId = equipo.laboratorioId ?? null;
        this.observaciones = equipo.observaciones ?? '';
        this.cargando.set(false);
      },
      error: (error) => {
        this.notificaciones.error(mensajeError(error, 'No se pudo cargar el equipo.'));
        this.cargando.set(false);
        void this.router.navigate(['/inventario']);
      },
    });
  }

  // ------------------------------------------------------------------ Pasos

  protected siguiente(): void {
    if (!this.pasoValido(this.paso())) {
      return;
    }
    this.paso.update((p) => Math.min(p + 1, this.titulos.length - 1));
  }

  protected anterior(): void {
    this.paso.update((p) => Math.max(p - 1, 0));
  }

  protected irAPaso(indice: number): void {
    this.paso.set(indice);
  }

  /** Cada paso se valida al salir de el, no al final (RNF-25). */
  protected pasoValido(indice: number): boolean {
    switch (indice) {
      // Que es el equipo y como se le identifica: los datos que lo distinguen
      // de cualquier otro y los codigos con que figura en el patrimonio.
      case 0:
        return (
          !!this.nombre.trim() &&
          !!this.marca.trim() &&
          !!this.modelo.trim() &&
          this.categoriaId !== null &&
          !!this.numeroSerie.trim() &&
          !!this.codigoInventario.trim() &&
          !!this.codigoPatrimonial.trim()
        );
      // De donde viene, donde esta y que aspecto tiene. Lo unico obligatorio
      // es la adquisicion: laboratorio, observaciones y fotografia son
      // opcionales (RF-34, RN-29).
      case 1:
        return this.fechaValida && this.costoValido;
      default:
        return true;
    }
  }

  protected get todoValido(): boolean {
    return [0, 1].every((i) => this.pasoValido(i));
  }

  /**
   * RN-25: la fecha de adquisicion no puede ser futura ni anterior a 1980.
   *
   * <p>Las dos cotas van tambien en los atributos {@code min} y {@code max}
   * del campo, que es lo que acota el calendario del navegador; esta
   * comprobacion existe porque la fecha tambien se puede teclear.</p>
   */
  protected get fechaValida(): boolean {
    const fecha = this.fechaAdquisicion;
    return fecha >= this.fechaMinima && fecha <= this.fechaMaxima;
  }

  /** RN-25: el costo no puede ser negativo. */
  protected get costoValido(): boolean {
    return this.costo !== null && this.costo >= 0;
  }

  protected get sinSerie(): boolean {
    return this.numeroSerie.trim().toUpperCase() === 'S/N';
  }

  /** Comodin para el mobiliario y los bienes sin numero de serie (RF-39). */
  protected usarSinSerie(): void {
    this.numeroSerie = 'S/N';
  }

  protected get nombreCategoria(): string {
    return this.categorias().find((c) => c.id === this.categoriaId)?.nombre ?? '—';
  }

  protected get nombreLaboratorio(): string {
    return this.laboratorios().find((l) => l.id === this.laboratorioId)?.nombre ?? 'Sin ubicar';
  }

  // --------------------------------------------------------------- Guardado

  protected guardar(): void {
    if (!this.todoValido || this.guardando()) {
      return;
    }
    this.errores.set({});
    this.guardando.set(true);

    const peticion: EquipoPeticion = {
      nombre: this.nombre.trim(),
      marca: this.marca.trim(),
      modelo: this.modelo.trim(),
      numeroSerie: this.numeroSerie.trim(),
      codigoInventario: this.codigoInventario.trim(),
      codigoPatrimonial: this.codigoPatrimonial.trim(),
      categoriaId: this.categoriaId!,
      laboratorioId: this.laboratorioId,
      fechaAdquisicion: this.fechaAdquisicion,
      costo: this.costo!,
      observaciones: this.observaciones.trim() || null,
    };

    const accion = this.id
      ? this.inventario.editar(this.id, peticion)
      : this.inventario.crear(peticion);

    accion.subscribe({
      next: (equipo) => {
        const foto = this.foto();
        if (foto) {
          // El bien ya existe —acaba de registrarse o ya estaba—: la fotografia
          // se adjunta sobre el, que es la unica forma de enviar una imagen
          // (RF-51b, RF-51c).
          this.adjuntarFoto(equipo, foto);
          return;
        }
        this.guardando.set(false);
        // RNF-31: se confirma que ocurrio y en que condicion quedo el equipo.
        this.notificaciones.exito(
          this.id
            ? `${equipo.nombre} se actualizo correctamente.`
            : `Equipo registrado. Quedo en condicion ${equipo.condicionEtiqueta}.`,
        );
        void this.router.navigate(['/inventario', equipo.id]);
      },
      error: (error) => {
        const porCampo = erroresDeCampo(error);
        this.errores.set(porCampo);
        this.guardando.set(false);
        this.notificaciones.error(mensajeError(error, 'No se pudo guardar el equipo.'));
        // Lleva al usuario al paso donde esta el campo rechazado (RNF-25).
        this.saltarAlPrimerError(porCampo);
      },
    });
  }

  /**
   * Adjunta la fotografia al bien recien registrado (RF-51b).
   *
   * <p>El alta y la fotografia son dos operaciones: el bien no puede recibir
   * una imagen antes de existir. Si la segunda falla, la primera se conserva
   * —el equipo ya esta en el inventario— y se avisa que la fotografia quedo
   * pendiente, que se adjunta desde la ficha. Perder un alta completa por una
   * imagen opcional seria el peor de los desenlaces (RNF-31).</p>
   */
  private adjuntarFoto(equipo: Equipo, foto: File): void {
    const esEdicion = this.id !== null;
    this.inventario.subirFoto(equipo.id, foto).subscribe({
      next: () => {
        this.guardando.set(false);
        this.notificaciones.exito(
          esEdicion
            ? `${equipo.nombre} se actualizo, con su fotografia.`
            : `Equipo registrado con su fotografia. Quedo en condicion ${equipo.condicionEtiqueta}.`,
        );
        void this.router.navigate(['/inventario', equipo.id]);
      },
      error: (error) => {
        this.guardando.set(false);
        this.notificaciones.alerta(
          `${equipo.nombre} ${esEdicion ? 'se actualizo' : 'quedo registrado'}, pero la ` +
            `fotografia no se pudo guardar: ` +
            `${mensajeError(error, 'vuelva a intentarlo desde Editar.')}`,
        );
        void this.router.navigate(['/inventario', equipo.id]);
      },
    });
  }

  /** El paso de fotografia es opcional: puede continuarse sin elegir nada. */
  protected alElegirFoto(archivo: File | null): void {
    this.foto.set(archivo);
  }

  protected get nombreFoto(): string {
    const elegida = this.foto();
    if (elegida) {
      return elegida.name;
    }
    // En la edicion, no elegir nada no es quedarse sin foto: es conservar la
    // que el equipo ya tiene, y el resumen tiene que decirlo con esas palabras.
    if (this.esEdicion()) {
      return this.original()?.fotoUrl ? 'Se conserva la actual' : 'Sin fotografía';
    }
    return 'Sin fotografía';
  }

  protected cancelar(): void {
    if (this.id) {
      void this.router.navigate(['/inventario', this.id]);
      return;
    }
    void this.router.navigate(['/inventario']);
  }

  private saltarAlPrimerError(errores: Record<string, string>): void {
    const pasoDeCampo: Record<string, number> = {
      nombre: 0,
      marca: 0,
      modelo: 0,
      categoriaId: 0,
      numeroSerie: 0,
      codigoInventario: 0,
      codigoPatrimonial: 0,
      fechaAdquisicion: 1,
      costo: 1,
      laboratorioId: 1,
      observaciones: 1,
    };
    const destinos = Object.keys(errores)
      .map((campo) => pasoDeCampo[campo])
      .filter((p) => p !== undefined);
    if (destinos.length > 0) {
      this.paso.set(Math.min(...destinos));
    }
  }
}
