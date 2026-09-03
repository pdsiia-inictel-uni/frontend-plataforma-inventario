import { Component, OnInit, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, Validators } from '@angular/forms';

import { NotificacionStore } from '../../../../compartido/aplicacion/notificacion.store';
import { erroresDeCampo, mensajeError } from '../../../../compartido/infraestructura/http/error.interceptor';
import { coincidenPasswords, passwordSeguro } from '../../aplicacion/politica-password';
import { SesionStore } from '../../aplicacion/sesion.store';
import { coordinacionDe } from '../../dominio/usuario.model';

/**
 * Datos de la cuenta propia: cambio de nombre de usuario / correo y de la
 * contrasena (RF-01, RF-05, RNF-05).
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

  /** RN-05: cada persona pertenece a una sola coordinacion. */
  protected get nombreDeSuCoordinacion(): string {
    return coordinacionDe(this.usuario()!);
  }

  protected readonly guardandoCuenta = signal(false);
  protected readonly guardandoPassword = signal(false);
  protected readonly erroresCuenta = signal<Record<string, string>>({});
  protected readonly erroresPassword = signal<Record<string, string>>({});

  protected readonly formCuenta = this.fb.nonNullable.group({
    username: ['', [Validators.required, Validators.minLength(4), Validators.maxLength(50),
      Validators.pattern(/^[a-zA-Z0-9._-]+$/)]],
    correo: ['', [Validators.required, Validators.email, Validators.maxLength(150)]],
    passwordActual: ['', [Validators.required]],
  });

  protected readonly formPassword = this.fb.nonNullable.group(
    {
      passwordActual: ['', [Validators.required]],
      passwordNueva: ['', [Validators.required, passwordSeguro]],
      confirmacion: ['', [Validators.required]],
    },
    { validators: [coincidenPasswords] },
  );

  ngOnInit(): void {
    const u = this.usuario();
    if (u) {
      this.formCuenta.patchValue({ username: u.username, correo: u.correo });
    }
    // Mantiene los datos sincronizados con el servidor al entrar a la pantalla.
    this.sesion.refrescarPerfil().subscribe({
      next: (perfil) => this.formCuenta.patchValue({ username: perfil.username, correo: perfil.correo }),
      error: () => undefined,
    });
  }

  protected guardarCuenta(): void {
    this.erroresCuenta.set({});
    if (this.formCuenta.invalid) {
      this.formCuenta.markAllAsTouched();
      return;
    }

    const valores = this.formCuenta.getRawValue();
    this.guardandoCuenta.set(true);
    this.sesion
      .cambiarCredenciales({
        username: valores.username.trim(),
        correo: valores.correo.trim(),
        passwordActual: valores.passwordActual,
      })
      .subscribe({
        next: () => {
          this.guardandoCuenta.set(false);
          this.formCuenta.controls.passwordActual.reset('');
          this.notificaciones.exito('Sus datos de acceso se actualizaron.');
        },
        error: (err) => {
          this.guardandoCuenta.set(false);
          this.erroresCuenta.set(erroresDeCampo(err));
          this.notificaciones.error(mensajeError(err, 'No se pudieron actualizar sus datos.'));
        },
      });
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
        this.formPassword.reset({ passwordActual: '', passwordNueva: '', confirmacion: '' });
        this.notificaciones.exito('Su contraseña se actualizo correctamente.');
      },
      error: (err) => {
        this.guardandoPassword.set(false);
        this.erroresPassword.set(erroresDeCampo(err));
        this.notificaciones.error(mensajeError(err, 'No se pudo cambiar la contraseña.'));
      },
    });
  }

  protected invalidoCuenta(campo: string): boolean {
    const control = this.formCuenta.get(campo);
    if (!control) {
      return false;
    }
    return (control.invalid || !!this.erroresCuenta()[campo]) && (control.touched || control.dirty);
  }

  protected invalidoPassword(campo: string): boolean {
    const control = this.formPassword.get(campo);
    if (!control) {
      return false;
    }
    return (control.invalid || !!this.erroresPassword()[campo]) && (control.touched || control.dirty);
  }

  protected mensajeCuenta(campo: string): string {
    return this.mensaje(this.formCuenta.get(campo), this.erroresCuenta()[campo], campo);
  }

  protected mensajePassword(campo: string): string {
    return this.mensaje(this.formPassword.get(campo), this.erroresPassword()[campo], campo);
  }

  protected get noCoinciden(): boolean {
    return this.formPassword.hasError('noCoinciden') && this.formPassword.controls.confirmacion.touched;
  }

  private mensaje(control: AbstractControl | null, delServidor: string | undefined, campo: string): string {
    if (delServidor) {
      return delServidor;
    }
    if (control?.hasError('required')) {
      return 'Este dato es obligatorio.';
    }
    if (campo === 'username' && control?.hasError('pattern')) {
      return 'Solo se admiten letras, numeros, punto, guion y guion bajo.';
    }
    if (control?.hasError('minlength')) {
      return 'Debe tener al menos 4 caracteres.';
    }
    if (control?.hasError('email')) {
      return 'El correo institucional no tiene un formato valido.';
    }
    if (control?.hasError('passwordSeguro')) {
      return 'Mínimo 8 caracteres, con letras, numeros y al menos un caracter especial.';
    }
    return '';
  }
}
