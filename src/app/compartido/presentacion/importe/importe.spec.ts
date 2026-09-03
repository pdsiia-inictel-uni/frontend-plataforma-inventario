import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Importe } from './importe';

@Component({
  standalone: true,
  imports: [Importe],
  template: `<input type="text" [(appImporte)]="costo" />`,
})
class Anfitrion {
  costo: number | null = null;
}

describe('Campo de importe (directiva Importe)', () => {
  let fixture: ComponentFixture<Anfitrion>;
  let anfitrion: Anfitrion;
  let campo: HTMLInputElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Anfitrion] }).compileComponents();
  });

  /** Monta el campo con el valor que traeria el equipo cargado del servidor. */
  function montar(costoInicial: number | null = null): void {
    fixture = TestBed.createComponent(Anfitrion);
    anfitrion = fixture.componentInstance;
    anfitrion.costo = costoInicial;
    fixture.detectChanges();
    campo = fixture.nativeElement.querySelector('input') as HTMLInputElement;
  }

  /** Escribe como lo haria una persona: con el campo enfocado. */
  function teclear(texto: string, cursor = texto.length): void {
    campo.focus();
    campo.value = texto;
    campo.setSelectionRange(cursor, cursor);
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function salirDelCampo(): void {
    campo.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
  }

  it('el campo vacio no muestra ningun cero', () => {
    montar();
    expect(campo.value).toBe('');
    expect(anfitrion.costo).toBeNull();
  });

  it('muestra con formato el valor que llega del servidor', () => {
    montar(18789.5);
    expect(campo.value).toBe('18,789.50');
  });

  it('agrupa los millares mientras se escribe', () => {
    montar();
    teclear('18789');
    expect(campo.value).toBe('18,789');
    expect(anfitrion.costo).toBe(18789);
  });

  it('el punto abre los centimos y no se pierde al seguir tecleando', () => {
    montar();
    teclear('150.');
    expect(campo.value).toBe('150.');
    teclear('150.5');
    expect(campo.value).toBe('150.5');
    expect(anfitrion.costo).toBe(150.5);
  });

  it('completa los centimos al salir del campo', () => {
    montar();
    teclear('150');
    salirDelCampo();
    expect(campo.value).toBe('150.00');
    expect(anfitrion.costo).toBe(150);
  });

  it('18789 acaba siendo 18,789.00', () => {
    montar();
    teclear('18789');
    salirDelCampo();
    expect(campo.value).toBe('18,789.00');
    expect(anfitrion.costo).toBe(18789);
  });

  it('ignora las letras', () => {
    montar();
    teclear('12a3');
    expect(campo.value).toBe('123');
  });

  it('el cursor no se va al final al insertarse una coma', () => {
    montar();
    // Al escribir la cuarta cifra de 1878 el formato inserta la coma delante,
    // pero el cursor debe seguir detras de la cifra recien escrita.
    teclear('1878', 4);
    expect(campo.value).toBe('1,878');
    expect(campo.selectionStart).toBe(5);
  });

  it('el cursor se conserva al corregir una cifra del medio', () => {
    montar(18789);
    expect(campo.value).toBe('18,789.00');

    // Borra el 7, dejando el cursor donde estaba: "18,|89.00".
    teclear('18,89.00', 3);
    expect(campo.value).toBe('1,889.00');
    // Habia dos cifras a la izquierda del cursor (1 y 8) y ahi sigue,
    // "1,8|89.00", aunque la coma se haya movido de sitio.
    expect(campo.selectionStart).toBe(3);
  });

  it('no reescribe el campo bajo los dedos del usuario', () => {
    montar();
    // Con el campo enfocado y a medio escribir, que el modelo valga 150 no
    // debe completar los centimos ni mover el cursor.
    teclear('150.');
    anfitrion.costo = 150;
    fixture.detectChanges();
    expect(campo.value).toBe('150.');
  });

  it('borrarlo todo devuelve el costo a nulo', () => {
    montar();
    teclear('150');
    teclear('');
    expect(campo.value).toBe('');
    expect(anfitrion.costo).toBeNull();
  });
});
