import { AbstractControl, ValidationErrors } from '@angular/forms';

/**
 * Politica de contrasenas del sistema (RNF-05), replicada en el cliente para
 * dar retroalimentacion inmediata. El backend la vuelve a exigir siempre.
 */
export function passwordSeguro(control: AbstractControl): ValidationErrors | null {
  const valor = String(control.value ?? '');
  if (!valor) {
    return null;
  }
  const tieneLetra = /[a-zA-Z]/.test(valor);
  const tieneNumero = /[0-9]/.test(valor);
  const tieneEspecial = /[^a-zA-Z0-9\s]/.test(valor);
  const valida = valor.length >= 8 && tieneLetra && tieneNumero && tieneEspecial;
  return valida ? null : { passwordSeguro: true };
}

/** La confirmacion debe coincidir con la nueva contrasena. */
export function coincidenPasswords(grupo: AbstractControl): ValidationErrors | null {
  const nueva = grupo.get('passwordNueva')?.value;
  const confirmacion = grupo.get('confirmacion')?.value;
  if (!nueva || !confirmacion) {
    return null;
  }
  return nueva === confirmacion ? null : { noCoinciden: true };
}
