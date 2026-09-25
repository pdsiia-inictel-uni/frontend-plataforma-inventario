import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Icono } from '../icono/icono';
import { Credencial } from './credencial';

describe('Contraseña temporal con boton Copiar (RF-06)', () => {
  let fixture: ComponentFixture<Credencial>;
  let copiado: string | null;
  let original: PropertyDescriptor | undefined;

  function simularPortapapeles(escribir: (texto: string) => Promise<void>): void {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: escribir },
    });
  }

  beforeEach(async () => {
    original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    copiado = null;
    await TestBed.configureTestingModule({ declarations: [Credencial, Icono] }).compileComponents();
    fixture = TestBed.createComponent(Credencial);
    fixture.componentRef.setInput('password', 'Xk7#pQ2m');
    fixture.detectChanges();
  });

  afterEach(() => {
    if (original) {
      Object.defineProperty(navigator, 'clipboard', original);
    } else {
      delete (navigator as { clipboard?: unknown }).clipboard;
    }
  });

  function boton(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('button') as HTMLButtonElement;
  }

  async function pulsar(): Promise<void> {
    boton().click();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('muestra la contraseña y el boton Copiar', () => {
    expect(fixture.nativeElement.querySelector('.credencial').textContent.trim()).toBe('Xk7#pQ2m');
    expect(boton().textContent.trim()).toBe('Copiar');
  });

  it('un clic copia exactamente la contraseña y confirma la copia', async () => {
    simularPortapapeles(async (texto) => {
      copiado = texto;
    });
    await pulsar();
    expect(copiado).toBe('Xk7#pQ2m');
    expect(boton().textContent.trim()).toBe('Copiada');
    expect(fixture.nativeElement.textContent).toContain('Contraseña copiada al portapapeles.');
  });

  it('si el navegador niega el portapapeles, deja el texto seleccionado y lo dice', async () => {
    simularPortapapeles(() => Promise.reject(new Error('denegado')));
    await pulsar();
    expect(window.getSelection()?.toString()).toBe('Xk7#pQ2m');
    expect(fixture.nativeElement.textContent).toContain('presione Ctrl+C');
  });
});
