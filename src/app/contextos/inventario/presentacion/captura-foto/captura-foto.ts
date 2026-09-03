import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  effect,
  signal,
  viewChild,
} from '@angular/core';

/**
 * Captura de la fotografia del bien durante su registro (RF-51b).
 *
 * <p>El bien se fotografia donde esta, y quien lo registra suele hacerlo con
 * una tablet en la mano recorriendo el laboratorio: obligarlo a fotografiar
 * primero, guardar el archivo y buscarlo despues en el explorador es pedirle
 * tres pasos para lo que el dispositivo resuelve en uno. Por eso el componente
 * ofrece las dos vias con el mismo peso visual: <em>tomar la foto</em> con la
 * camara del dispositivo o <em>elegir un archivo</em> ya existente.</p>
 *
 * <p>La camara se abre con {@code getUserMedia} y se previsualiza en vivo; la
 * imagen se congela en un lienzo y viaja como JPEG. Si el navegador no expone
 * camara, la deniega o no hay ninguna, el componente no se queda sin salida:
 * degrada al selector de archivos con {@code capture}, que en tablet y movil
 * abre la aplicacion de camara del sistema.</p>
 *
 * <p>El flujo de video se enlaza por codigo sobre el elemento —nunca por
 * atributo— y la vista previa es un {@code blob:}, ambos compatibles con la
 * politica estricta de seguridad de contenido (RNF-07).</p>
 */
@Component({
  selector: 'app-captura-foto',
  standalone: false,
  templateUrl: './captura-foto.html',
})
export class CapturaFoto implements OnInit, OnDestroy {
  /**
   * Fotografia ya elegida en una visita anterior al paso.
   *
   * <p>El asistente destruye el paso al avanzar, de modo que sin esto volver
   * atras desde el resumen mostraria "todavia no ha elegido ninguna" sobre una
   * foto que el usuario sí tomo, y le haria repetirla sin necesidad.</p>
   */
  @Input() inicial: File | null = null;

  /** La fotografia elegida, o null si el usuario la retira. Es opcional. */
  @Output() elegida = new EventEmitter<File | null>();

  /** El mismo limite que acepta el servidor (spring.servlet.multipart). */
  private static readonly TAMANO_MAXIMO = 5 * 1024 * 1024;

  /** Los mismos formatos que admite el almacen de fotografias del backend. */
  private static readonly TIPOS = ['image/jpeg', 'image/png', 'image/webp'];

  /** Lado mayor de la captura: mas resolucion no aporta y engorda el envio. */
  private static readonly LADO_MAXIMO = 1600;

  private readonly visor = viewChild<ElementRef<HTMLVideoElement>>('visor');

  protected readonly archivo = signal<File | null>(null);
  protected readonly vistaPrevia = signal<string | null>(null);
  protected readonly flujo = signal<MediaStream | null>(null);
  protected readonly abriendo = signal(false);
  protected readonly error = signal<string | null>(null);

  /**
   * La camara en vivo se ofrece mientras el navegador la exponga y no la haya
   * rechazado. Al primer fallo se baja la bandera y la interfaz pasa a la via
   * del selector con {@code capture}, sin dejar al usuario sin opcion.
   */
  protected readonly camaraEnVivo = signal(
    typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia,
  );

  constructor() {
    // El visor solo existe mientras la camara esta abierta, de modo que el
    // flujo se enlaza cuando ambos coinciden.
    effect(() => {
      const elemento = this.visor()?.nativeElement;
      const flujo = this.flujo();
      if (!elemento || !flujo || elemento.srcObject === flujo) {
        return;
      }
      elemento.srcObject = flujo;
      void elemento.play().catch(() => undefined);
    });
  }

  ngOnInit(): void {
    if (this.inicial) {
      // Se restaura la vista previa sin volver a emitirla: el padre ya la tiene.
      this.archivo.set(this.inicial);
      this.vistaPrevia.set(URL.createObjectURL(this.inicial));
    }
  }

  ngOnDestroy(): void {
    this.cerrarCamara();
    this.liberarVistaPrevia();
  }

  // ------------------------------------------------------------ Camara viva

  protected async abrirCamara(): Promise<void> {
    if (this.abriendo() || this.flujo()) {
      return;
    }
    this.error.set(null);
    this.abriendo.set(true);
    try {
      // facingMode 'environment' pide la camara trasera de la tablet, que es
      // la que apunta al equipo; en un portatil el navegador la ignora y
      // entrega la unica que tiene.
      const flujo = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      this.flujo.set(flujo);
    } catch {
      // Permiso denegado, sin camara o contexto no seguro: se explica en
      // lenguaje natural y se ofrece la alternativa (RNF-25).
      this.camaraEnVivo.set(false);
      this.error.set(
        'No se pudo abrir la cámara. Puede tomar la foto con la aplicación de cámara del ' +
          'dispositivo o elegir una imagen guardada.',
      );
    } finally {
      this.abriendo.set(false);
    }
  }

  protected capturar(): void {
    const elemento = this.visor()?.nativeElement;
    if (!elemento || !elemento.videoWidth) {
      return;
    }

    const escala = Math.min(
      1,
      CapturaFoto.LADO_MAXIMO / Math.max(elemento.videoWidth, elemento.videoHeight),
    );
    const lienzo = document.createElement('canvas');
    lienzo.width = Math.round(elemento.videoWidth * escala);
    lienzo.height = Math.round(elemento.videoHeight * escala);

    const contexto = lienzo.getContext('2d');
    if (!contexto) {
      this.error.set('El navegador no pudo procesar la imagen. Elija un archivo.');
      return;
    }
    contexto.drawImage(elemento, 0, 0, lienzo.width, lienzo.height);

    lienzo.toBlob(
      (blob) => {
        if (!blob) {
          this.error.set('El navegador no pudo procesar la imagen. Elija un archivo.');
          return;
        }
        const nombre = `equipo-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '')}.jpg`;
        this.cerrarCamara();
        this.aceptar(new File([blob], nombre, { type: 'image/jpeg' }));
      },
      'image/jpeg',
      0.85,
    );
  }

  protected cerrarCamara(): void {
    const flujo = this.flujo();
    if (!flujo) {
      return;
    }
    flujo.getTracks().forEach((pista) => pista.stop());
    this.flujo.set(null);
  }

  // ---------------------------------------------------------- Archivo local

  protected alElegirArchivo(evento: Event): void {
    const entrada = evento.target as HTMLInputElement;
    const archivo = entrada.files?.[0] ?? null;
    entrada.value = '';
    if (!archivo) {
      return;
    }
    if (!CapturaFoto.TIPOS.includes(archivo.type.toLowerCase())) {
      this.error.set('Formato no admitido. Use una imagen JPG, PNG o WEBP.');
      return;
    }
    if (archivo.size > CapturaFoto.TAMANO_MAXIMO) {
      this.error.set('La imagen supera los 5 MB. Tome la foto con menos resolucion.');
      return;
    }
    this.aceptar(archivo);
  }

  // ------------------------------------------------------------- Resultado

  protected quitar(): void {
    this.liberarVistaPrevia();
    this.archivo.set(null);
    this.error.set(null);
    this.elegida.emit(null);
  }

  private aceptar(archivo: File): void {
    this.liberarVistaPrevia();
    this.error.set(null);
    this.archivo.set(archivo);
    this.vistaPrevia.set(URL.createObjectURL(archivo));
    this.elegida.emit(archivo);
  }

  private liberarVistaPrevia(): void {
    const actual = this.vistaPrevia();
    if (actual) {
      URL.revokeObjectURL(actual);
      this.vistaPrevia.set(null);
    }
  }
}
