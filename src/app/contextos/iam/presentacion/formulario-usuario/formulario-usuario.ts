import { Component, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';

import { NotificacionStore } from '../../../../compartido/aplicacion/notificacion.store';
import {
  erroresDeCampo,
  mensajeError,
} from '../../../../compartido/infraestructura/http/error.interceptor';
import { UsuariosFacade } from '../../aplicacion/usuarios.facade';
import { Usuario, UsuarioPeticion } from '../../dominio/usuario.model';

/**
 * Alta y edicion de los datos de una persona (RF-16, RF-16b, RF-21).
 *
 * <p>El formulario responde a una sola pregunta: <b>quien es</b>. Ni rol ni
 * coordinacion: eso es el puesto, y se decide despues, al asignarla (RF-28d).
 * Hasta la v3.2 habia que decidirlo todo aqui, el primer dia, cuando muchas
 * veces todavia no se sabe donde va a trabajar la persona; y la contrasena
 * nacia con el alta, para una cuenta que aun no podia hacer nada.</p>
 *
 * <p>Quien queda registrado aparece en la lista de personas marcado como
 * <em>Sin asignar</em>, y desde ahi se le da su puesto.</p>
 *
 * <p><b>Nada se guarda sin confirmarlo (v3.4).</b> Al enviar, el formulario no
 * registra: abre una ventana de confirmacion con los datos tal como van a
 * quedar y con lo que le faltara a la persona para poder entrar. Aceptar
 * registra; cancelar descarta el registro entero (RNF-26). Los datos
 * personales de alguien se escriben una vez y se leen durante anos: merecen
 * una lectura antes de quedar fijados.</p>
 */
@Component({
  selector: 'app-formulario-usuario',
  standalone: false,
  templateUrl: './formulario-usuario.html',
})
export class FormularioUsuario implements OnInit {
  private readonly usuarios = inject(UsuariosFacade);
  private readonly notificaciones = inject(NotificacionStore);

  /** Persona a editar; si no llega, es un alta. */
  @Input() usuario: Usuario | null = null;
  /** DNI ya conocido por la pantalla que abre el formulario. */
  @Input() dniPrecargado = '';
  /**
   * Entrega los datos en lugar de guardarlos.
   *
   * <p>Lo usa "Mi equipo humano": alli el alta y la asignacion se resuelven de
   * un tiron, porque el Responsable ya sabe donde va a trabajar la persona que
   * registra (RNF-22).</p>
   */
  @Input() soloDatos = false;
  /** Aviso propio de la pantalla que abre el formulario, si lo necesita. */
  @Input() nota = '';

  /**
   * Errores por campo que devolvio el servidor a quien guardo los datos.
   *
   * <p>Solo tiene sentido con {@link soloDatos}: alli el formulario entrega
   * los datos y es la pantalla de fuera quien los envia, de modo que la
   * respuesta del servidor llega a otro sitio. Sin esto, un DNI repetido se
   * anunciaba en un aviso flotante generico y el campo que hay que corregir
   * quedaba sin senalar (RNF-25).</p>
   */
  @Input() set erroresServidor(errores: Record<string, string> | null) {
    this.errores.set(errores ?? {});
  }

  @Output() guardado = new EventEmitter<Usuario>();
  @Output() datosListos = new EventEmitter<UsuarioPeticion>();
  @Output() cancelado = new EventEmitter<void>();

  protected readonly guardando = signal(false);
  protected readonly errores = signal<Record<string, string>>({});

  /**
   * Datos a la espera de que se acepten (RNF-26).
   *
   * <p>Mientras hay algo aqui, la ventana de confirmacion esta abierta y nada
   * se ha enviado todavia al servidor.</p>
   */
  protected readonly confirmando = signal<UsuarioPeticion | null>(null);

  protected username = '';
  protected nombres = '';
  protected primerApellido = '';
  protected segundoApellido = '';
  protected dni = '';
  protected cargo = '';
  protected correo = '';

  ngOnInit(): void {
    if (this.usuario) {
      this.username = this.usuario.username;
      this.nombres = this.usuario.nombres;
      this.primerApellido = this.usuario.primerApellido;
      this.segundoApellido = this.usuario.segundoApellido ?? '';
      this.dni = this.usuario.dni;
      this.cargo = this.usuario.cargo ?? '';
      this.correo = this.usuario.correo;
      return;
    }
    this.dni = this.dniPrecargado;
  }

  protected get esEdicion(): boolean {
    return this.usuario !== null;
  }

  protected get titulo(): string {
    return this.esEdicion ? 'Editar persona' : 'Nueva persona';
  }

  // Ni el nombre de usuario ni el correo se sugieren: los dos se escriben
  // enteros, a mano (RF-16). El sistema los componia a partir del nombre real
  // —"jperez", "juan.perez@inictel-uni.edu.pe"— y acertaba a menudo, que es
  // justo lo que lo hacia peligroso: las veces que no acertaba, el dato
  // equivocado ya estaba escrito en el campo, con aspecto de correcto, y nadie
  // vuelve a leer lo que el propio formulario acaba de rellenar. Un campo
  // vacio se ve; un campo mal relleno, no. Ademas ninguno de los dos los
  // decide el sistema: el usuario y el correo de una persona son los que la
  // institucion le dio.

  /**
   * Enviar el formulario abre la confirmacion; no guarda todavia (RNF-26).
   */
  protected revisar(): void {
    if (this.guardando() || !this.valido) {
      return;
    }
    this.errores.set({});
    this.confirmando.set({
      username: this.username.trim(),
      nombres: this.nombres.trim(),
      primerApellido: this.primerApellido.trim(),
      segundoApellido: this.segundoApellido.trim(),
      dni: this.dni.trim(),
      cargo: this.cargo.trim() || null,
      correo: this.correo.trim(),
    });
  }

  /**
   * Cancela el registro entero desde la confirmacion.
   *
   * <p>Cancelar ahi no es "volver al formulario": es decir que no. La ventana
   * lo enuncia asi y el formulario se cierra sin dejar nada a medias.</p>
   */
  protected cancelarConfirmacion(): void {
    this.confirmando.set(null);
    this.cancelado.emit();
  }

  /** Aceptada la confirmacion, ahora si se guarda. */
  protected guardar(): void {
    const peticion = this.confirmando();
    if (!peticion || this.guardando()) {
      return;
    }
    this.guardando.set(true);

    if (this.soloDatos) {
      this.guardando.set(false);
      this.confirmando.set(null);
      this.datosListos.emit(peticion);
      return;
    }

    const fallar = (error: unknown) => {
      // El formulario vuelve a la vista con el error junto a su campo: lo que
      // hay que corregir es un dato, no la decision de registrar (RNF-25).
      this.confirmando.set(null);
      this.errores.set(erroresDeCampo(error));
      this.notificaciones.error(mensajeError(error, 'No se pudo guardar la persona.'));
      this.guardando.set(false);
    };

    if (this.usuario) {
      this.usuarios.editar(this.usuario.id, peticion).subscribe({
        next: (actualizado) => {
          this.guardando.set(false);
          this.confirmando.set(null);
          this.notificaciones.exito('Datos actualizados.');
          this.guardado.emit(actualizado);
        },
        error: fallar,
      });
      return;
    }

    this.usuarios.crear(peticion).subscribe({
      next: (registrada) => {
        this.guardando.set(false);
        this.confirmando.set(null);
        this.guardado.emit(registrada);
      },
      error: fallar,
    });
  }

  /** Nombre completo tal como quedara registrado, para la confirmacion. */
  protected get nombreCompleto(): string {
    return [this.nombres, this.primerApellido, this.segundoApellido]
      .map((parte) => parte.trim())
      .filter((parte) => parte.length > 0)
      .join(' ');
  }

  protected get tituloConfirmacion(): string {
    return this.esEdicion ? 'Confirmar los cambios' : 'Confirmar el registro';
  }

  protected get textoAceptar(): string {
    if (this.guardando()) {
      return 'Guardando...';
    }
    return 'Aceptar';
  }

  protected get valido(): boolean {
    return (
      this.username.trim().length >= 4 &&
      this.nombres.trim().length > 0 &&
      this.primerApellido.trim().length > 0 &&
      // RF-16: los dos apellidos son obligatorios en toda alta y edicion.
      this.segundoApellido.trim().length > 0 &&
      /^[0-9]{8}$/.test(this.dni.trim()) &&
      this.correo.trim().length > 0
    );
  }

  /** RF-24: el DNI son exactamente 8 digitos numericos. */
  protected get dniInvalido(): boolean {
    return this.dni.trim().length > 0 && !/^[0-9]{8}$/.test(this.dni.trim());
  }
}
