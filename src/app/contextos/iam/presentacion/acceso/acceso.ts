import { Component, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { environment } from '../../../../../environments/environment';
import { mensajeError } from '../../../../compartido/infraestructura/http/error.interceptor';
import { SesionStore } from '../../aplicacion/sesion.store';

/**
 * Pantalla de inicio de sesion (RF-01, RF-02).
 */
@Component({
  selector: 'app-acceso',
  standalone: false,
  templateUrl: './acceso.html',
})
export class Acceso {
  private readonly fb = inject(FormBuilder);
  private readonly sesion = inject(SesionStore);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);

  protected readonly entorno = environment;
  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly aviso = signal<string | null>(null);
  protected verPassword = false;

  protected readonly formulario = this.fb.nonNullable.group({
    usuario: ['', [Validators.required]],
    password: ['', [Validators.required]],
  });

  constructor() {
    const motivo = this.ruta.snapshot.queryParamMap.get('motivo');
    if (motivo === 'expirada') {
      this.aviso.set('Su sesión expiró. Vuelva a iniciar sesión.');
    } else if (motivo === 'cerrada') {
      this.aviso.set('Cerró sesión correctamente.');
    }
  }

  protected enviar(): void {
    this.error.set(null);
    this.aviso.set(null);

    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    this.enviando.set(true);
    this.sesion.iniciarSesion(this.formulario.getRawValue()).subscribe({
      next: (sesion) => {
        this.enviando.set(false);
        if (sesion.debeCambiarPassword) {
          void this.router.navigate(['/cambiar-password']);
          return;
        }
        // RNF-36: la pagina principal depende del rol; el Administrador entra
        // a la estructura organizacional y los demas a su panel.
        const retorno = this.ruta.snapshot.queryParamMap.get('retorno');
        void this.router.navigateByUrl(
          retorno && !retorno.startsWith('/acceso') ? retorno : this.sesion.rutaInicio(),
        );
      },
      error: (err) => {
        this.enviando.set(false);
        this.error.set(mensajeError(err, 'No se pudo iniciar sesión.'));
      },
    });
  }

  protected invalido(campo: 'usuario' | 'password'): boolean {
    const control = this.formulario.controls[campo];
    return control.invalid && (control.touched || control.dirty);
  }
}
