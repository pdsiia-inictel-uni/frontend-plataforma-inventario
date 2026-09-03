import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { environment } from '../../../../../environments/environment';
import { NotificacionStore } from '../../../../compartido/aplicacion/notificacion.store';
import { erroresDeCampo, mensajeError } from '../../../../compartido/infraestructura/http/error.interceptor';
import { coincidenPasswords, passwordSeguro } from '../../aplicacion/politica-password';
import { SesionStore } from '../../aplicacion/sesion.store';

type CampoPassword = 'passwordActual' | 'passwordNueva' | 'confirmacion';
type CampoIdentidad = 'nombres' | 'primerApellido' | 'segundoApellido' | 'dni';

/**
 * Primer ingreso al sistema (RF-06, RF-06b).
 *
 * <p>Todo usuario debe definir su contrasena antes de operar: la que trae es
 * la que le entrego el Administrador (o la de la cuenta inicial del sistema).</p>
 *
 * <p>El Administrador ademas confirma quien es. La cuenta inicial nace con un
 * nombre y un DNI de relleno, y el sistema identifica a las personas por su
 * DNI: dejarlos como estan seria arrancar con una identidad falsa. Por eso a
 * el se le presenta en dos pasos —primero quien es, luego su contrasena— y a
 * los demas, que llegan con sus datos ya cargados por quien los dio de alta,
 * un solo formulario.</p>
 *
 * <p>Su nombre se pide entero, segundo apellido incluido: es la identidad con
 * la que queda registrada la primera persona del sistema. El cargo no se
 * pregunta porque no hay nada que elegir —quien estrena la plataforma es el
 * Administrador del sistema— y se muestra ya resuelto.</p>
 */
@Component({
  selector: 'app-cambiar-password',
  standalone: false,
  templateUrl: './cambiar-password.html',
})
export class CambiarPassword {
  private readonly fb = inject(FormBuilder);
  private readonly sesion = inject(SesionStore);
  private readonly router = inject(Router);
  private readonly notificaciones = inject(NotificacionStore);

  protected readonly entorno = environment;
  protected readonly usuario = this.sesion.usuario;
  protected readonly esAdmin = this.sesion.esAdmin;

  protected readonly titulos = ['Sus datos', 'Su contraseña'];
  protected readonly paso = signal(0);

  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly erroresServidor = signal<Record<string, string>>({});

  /** RF-06b: solo lo completa el Administrador de la cuenta inicial. */
  protected readonly formIdentidad = this.fb.nonNullable.group({
    nombres: ['', [Validators.required, Validators.maxLength(100)]],
    primerApellido: ['', [Validators.required, Validators.maxLength(100)]],
    segundoApellido: ['', [Validators.required, Validators.maxLength(100)]],
    dni: ['', [Validators.required, Validators.pattern(/^[0-9]{8}$/)]],
  });

  protected readonly formulario = this.fb.nonNullable.group(
    {
      passwordActual: ['', [Validators.required]],
      passwordNueva: ['', [Validators.required, passwordSeguro]],
      confirmacion: ['', [Validators.required]],
    },
    { validators: [coincidenPasswords] },
  );

  /** El paso de identidad solo existe para el Administrador. */
  protected readonly enPasoIdentidad = computed(() => this.esAdmin() && this.paso() === 0);

  protected continuar(): void {
    if (this.formIdentidad.invalid) {
      this.formIdentidad.markAllAsTouched();
      return;
    }
    this.error.set(null);
    this.paso.set(1);
  }

  protected volver(): void {
    this.paso.set(0);
  }

  protected enviar(): void {
    this.error.set(null);
    this.erroresServidor.set({});

    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }
    if (this.esAdmin() && this.formIdentidad.invalid) {
      this.formIdentidad.markAllAsTouched();
      this.paso.set(0);
      return;
    }

    this.enviando.set(true);
    const credenciales = this.formulario.getRawValue();

    const alTerminar = () => {
      this.enviando.set(false);
      this.notificaciones.exito(
        this.esAdmin()
          ? 'Sus datos y su contraseña quedaron registrados.'
          : 'Su contraseña se actualizo correctamente.',
      );
      void this.router.navigate([this.sesion.rutaInicio()]);
    };
    const alFallar = (err: unknown) => {
      this.enviando.set(false);
      const campos = erroresDeCampo(err);
      this.erroresServidor.set(campos);
      // El servidor puede rechazar un dato del primer paso (un DNI repetido):
      // volver al paso donde esta el error evita el mensaje que no se ve.
      if (this.esAdmin() && this.tieneErrorDeIdentidad(campos)) {
        this.paso.set(0);
      }
      this.error.set(mensajeError(err, 'No se pudo completar el ingreso.'));
    };

    if (!this.esAdmin()) {
      this.sesion.cambiarPassword(credenciales).subscribe({ next: alTerminar, error: alFallar });
      return;
    }

    const identidad = this.formIdentidad.getRawValue();
    this.sesion
      .completarPrimerIngreso({
        nombres: identidad.nombres.trim(),
        primerApellido: identidad.primerApellido.trim(),
        segundoApellido: identidad.segundoApellido.trim(),
        dni: identidad.dni.trim(),
        ...credenciales,
      })
      .subscribe({ next: alTerminar, error: alFallar });
  }

  protected cerrarSesion(): void {
    this.sesion.cerrarSesion('cerrada');
  }

  // ------------------------------------------------------- Validacion visible

  protected invalido(campo: CampoPassword): boolean {
    const control = this.formulario.controls[campo];
    return (control.invalid || !!this.erroresServidor()[campo]) && (control.touched || control.dirty);
  }

  protected mensajeCampo(campo: CampoPassword): string {
    const delServidor = this.erroresServidor()[campo];
    if (delServidor) {
      return delServidor;
    }
    const control = this.formulario.controls[campo];
    if (control.hasError('required')) {
      return 'Este dato es obligatorio.';
    }
    if (control.hasError('passwordSeguro')) {
      return 'Mínimo 8 caracteres, con letras, numeros y al menos un caracter especial.';
    }
    return '';
  }

  protected invalidoIdentidad(campo: CampoIdentidad): boolean {
    const control = this.formIdentidad.controls[campo];
    return (control.invalid || !!this.erroresServidor()[campo]) && (control.touched || control.dirty);
  }

  protected mensajeIdentidad(campo: CampoIdentidad): string {
    const delServidor = this.erroresServidor()[campo];
    if (delServidor) {
      return delServidor;
    }
    const control = this.formIdentidad.controls[campo];
    if (control.hasError('required')) {
      return 'Este dato es obligatorio.';
    }
    if (control.hasError('pattern')) {
      return 'El DNI debe tener exactamente 8 digitos numericos.';
    }
    if (control.hasError('maxlength')) {
      return 'El texto es demasiado largo.';
    }
    return '';
  }

  protected get noCoinciden(): boolean {
    return this.formulario.hasError('noCoinciden') && this.formulario.controls.confirmacion.touched;
  }

  private tieneErrorDeIdentidad(campos: Record<string, string>): boolean {
    return ['nombres', 'primerApellido', 'segundoApellido', 'dni'].some((c) => c in campos);
  }
}
