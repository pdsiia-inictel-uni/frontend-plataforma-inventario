import { Component } from '@angular/core';

/**
 * Raiz de la aplicacion: area de rutas y avisos emergentes.
 *
 * No declara estilos propios de componente para que Angular no inyecte
 * etiquetas <style> en tiempo de ejecucion; toda la hoja de estilos se sirve
 * como archivo, y asi la CSP puede mantener {@code style-src 'self'} (RNF-04).
 */
@Component({
  selector: 'app-root',
  standalone: false,
  templateUrl: './app.html',
})
export class App {}
