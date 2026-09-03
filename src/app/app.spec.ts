import { TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';

import { App } from './app';
import { Icono } from './compartido/presentacion/icono/icono';
import { Notificaciones } from './compartido/presentacion/notificaciones/notificaciones';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RouterModule.forRoot([])],
      declarations: [App, Notificaciones, Icono],
    }).compileComponents();
  });

  it('se crea la raiz de la aplicacion', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('expone el area de rutas y los avisos', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const html = fixture.nativeElement as HTMLElement;
    expect(html.querySelector('router-outlet')).toBeTruthy();
    expect(html.querySelector('app-notificaciones')).toBeTruthy();
  });

  it('no introduce manejadores ni estilos en linea (RNF-04)', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const html = (fixture.nativeElement as HTMLElement).innerHTML;
    expect(html).not.toContain('onclick=');
    expect(html).not.toContain('style=');
    expect(html).not.toContain('javascript:');
  });
});
