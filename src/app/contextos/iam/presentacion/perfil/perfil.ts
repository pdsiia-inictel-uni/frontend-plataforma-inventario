import { Component, HostListener, OnInit, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, Validators } from '@angular/forms';

import { NotificacionStore } from '../../../../compartido/aplicacion/notificacion.store';
import { erroresDeCampo, mensajeError } from '../../../../compartido/infraestructura/http/error.interceptor';
import { coincidenPasswords, passwordSeguro } from '../../aplicacion/politica-password';
import { SesionStore } from '../../aplicacion/sesion.store';
import { coordinacionDe } from '../../dominio/usuario.model';

/**
 * Mi cuenta: los datos de la persona y de su acceso, y el cambio de la propia
 * contrasena (RF-05, RF-06, RF-21c, RNF-05).
 *
 * <p>Todo lo que se ve es de lectura salvo la contrasena. El nombre, el DNI, el
 * nombre de usuario y el correo institucional los modifica quien gestiona la
 * cuenta: el Administrador, o el Responsable si es la de uno de sus
 * operadores. La contrasena la cambia cada uno, en una ventana aparte.</p>
 */
@Component({
  selector: 'app-perfil',
  standalone: false,
  templateUrl: './perfil.html',
})
export class Perfil implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly sesion = inject(SesionStore);
  private readonly notificaciones = inject(NotificacionStore);

  protected readonly usuario = this.sesion.usuario;

  /** Iniciales del nombre y del primer apellido, para el distintivo de la cabecera. */
  protected get iniciales(): string {
    const u = this.usuario();
    return u ? `${u.nombres.trim().charAt(0)}${u.primerApellido.trim().charAt(0)}`.toUpperCase() : '';
  }

  /** RN-05: cada persona pertenece a una sola coordinacion. */
  protected get nombreDeSuCoordinacion(): string {
    return coordinacionDe(this.usuario()!);
  }

  /** RF-21, RF-29: quién puede corregir estos datos depende del rol de la cuenta. */
  protected get quienModifica(): string {
    return this.usuario()?.rol === 'OPERADOR'
      ? 'Sus datos personales, su nombre de usuario y su correo institucional solo pueden ' +
          'modificarlos el Responsable de su coordinación o un Administrador.'
      : 'Sus datos personales, su nombre de usuario y su correo institucional solo puede ' +
          'modificarlos un Administrador.';
  }

  protected readonly cambiandoPassword = signal(false);
  protected readonly guardandoPassword = signal(false);
  protected readonly erroresPassword = signal<Record<string, string>>({});
  protected verActual = false;
  protected verNueva = false;
  protected verConfirmacion = false;

  protected readonly formPassword = this.fb.nonNullable.group(
    {
      passwordActual: ['', [Validators.required]],
      passwordNueva: ['', [Validators.required, passwordSeguro]],
      confirmacion: ['', [Validators.required]],
    },
    { validators: [coincidenPasswords] },
  );

  ngOnInit(): void {
    // Los datos pueden haberlos corregido el Administrador o el Responsable
    // desde otra sesion: se piden de nuevo al entrar a la pantalla.
    this.sesion.refrescarPerfil().subscribe({ error: () => undefined });
  }

  protected abrirCambioPassword(): void {
    this.reiniciarFormulario();
    this.cambiandoPassword.set(true);
  }

  /** Cancelar, el aspa, pulsar fuera o Escape: lo tecleado no se conserva. */
  @HostListener('document:keydown.escape')
  protected cerrarCambioPassword(): void {
    if (this.guardandoPassword()) {
      return;
    }
    this.cambiandoPassword.set(false);
    this.reiniciarFormulario();
  }

  protected guardarPassword(): void {
    this.erroresPassword.set({});
    if (this.formPassword.invalid) {
      this.formPassword.markAllAsTouched();
      return;
    }

    this.guardandoPassword.set(true);
    this.sesion.cambiarPassword(this.formPassword.getRawValue()).subscribe({
      next: () => {
        this.guardandoPassword.set(false);
        this.cambiandoPassword.set(false);
        this.reiniciarFormulario();
        this.notificaciones.exito('Su contraseña se actualizó correctamente.');
      },
      error: (err) => {
        this.guardandoPassword.set(false);
        this.erroresPassword.set(erroresDeCampo(err));
        this.notificaciones.error(mensajeError(err, 'No se pudo cambiar la contraseña.'));
      },
    });
  }

  private reiniciarFormulario(): void {
    this.formPassword.reset({ passwordActual: '', passwordNueva: '', confirmacion: '' });
    this.erroresPassword.set({});
    this.verActual = false;
    this.verNueva = false;
    this.verConfirmacion = false;
  }

  protected invalidoPassword(campo: string): boolean {
    const control = this.formPassword.get(campo);
    if (!control) {
      return false;
    }
    return (control.invalid || !!this.erroresPassword()[campo]) && (control.touched || control.dirty);
  }

  protected mensajePassword(campo: string): string {
    return this.mensaje(this.formPassword.get(campo), this.erroresPassword()[campo]);
  }

  protected get noCoinciden(): boolean {
    return this.formPassword.hasError('noCoinciden') && this.formPassword.controls.confirmacion.touched;
  }

  private mensaje(control: AbstractControl | null, delServidor: string | undefined): string {
    if (delServidor) {
      return delServidor;
    }
    if (control?.hasError('required')) {
      return 'Este dato es obligatorio.';
    }
    if (control?.hasError('passwordSeguro')) {
      return 'Mínimo 8 caracteres, con letras, números y al menos un carácter especial.';
    }
    return '';
  }
}
